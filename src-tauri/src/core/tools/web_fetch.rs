use serde_json::json;
use super::types::{ToolCall, ToolDef};

const WEB_FETCH_TIMEOUT_SECS: u64 = 30;
const MAX_RESPONSE_CHARS: usize = 50_000;

pub fn def() -> ToolDef {
    ToolDef {
        name: "web_fetch".to_string(),
        description: "Fetch the content of a URL and return it as text. HTML pages are simplified to plain text.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "HTTP/HTTPS URL to fetch"}
            },
            "required": ["url"]
        }),
    }
}

pub async fn execute(call: &ToolCall) -> Result<String, String> {
    let url = call.input["url"].as_str().unwrap_or("").trim().to_string();
    if url.is_empty() {
        return Err("url is required".into());
    }
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("url must start with http:// or https://".into());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(WEB_FETCH_TIMEOUT_SECS))
        .user_agent("Mozilla/5.0 (compatible; ChatCMS-Agent/1.0)")
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let status = resp.status();
    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let text = resp.text().await.map_err(|e| e.to_string())?;

    let body = if content_type.contains("text/html") {
        strip_html(&text)
    } else {
        text
    };

    let char_count = body.chars().count();
    let result = if char_count > MAX_RESPONSE_CHARS {
        let truncated: String = body.chars().take(MAX_RESPONSE_CHARS).collect();
        format!("{truncated}\n\n[已截断，共 {char_count} 字符]")
    } else {
        body
    };

    if !status.is_success() {
        return Err(format!("HTTP {}: {result}", status.as_u16()));
    }
    Ok(result)
}

fn strip_html(html: &str) -> String {
    let mut out = String::with_capacity(html.len() / 2);
    let mut in_tag = false;
    let mut in_script = false;
    let mut in_style = false;
    let mut tag_buf = String::new();
    let mut char_iter = html.chars().peekable();

    while let Some(c) = char_iter.next() {
        match c {
            '<' => {
                tag_buf.clear();
                in_tag = true;
            }
            '>' if in_tag => {
                let t = tag_buf.trim().to_lowercase();
                let tag = t.split_whitespace().next().unwrap_or("");
                match tag {
                    "script" => in_script = true,
                    "/script" => in_script = false,
                    "style" => in_style = true,
                    "/style" => in_style = false,
                    "p" | "br" | "div" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
                    | "li" | "tr" | "/p" | "/div" | "/li" | "/tr" => {
                        out.push('\n');
                    }
                    _ => {}
                }
                in_tag = false;
            }
            _ if in_tag => tag_buf.push(c),
            _ if in_script || in_style => {}
            '&' => {
                let mut entity = String::new();
                loop {
                    match char_iter.peek() {
                        Some(&';') => {
                            char_iter.next();
                            break;
                        }
                        Some(&ch) if ch.is_alphanumeric() || ch == '#' => {
                            entity.push(char_iter.next().unwrap());
                        }
                        _ => break,
                    }
                }
                match entity.as_str() {
                    "amp" => out.push('&'),
                    "lt" => out.push('<'),
                    "gt" => out.push('>'),
                    "quot" => out.push('"'),
                    "apos" => out.push('\''),
                    "nbsp" => out.push(' '),
                    _ => {
                        out.push('&');
                        out.push_str(&entity);
                    }
                }
            }
            _ => out.push(c),
        }
    }

    // Collapse blank lines
    let mut result = String::new();
    let mut prev_blank = false;
    for line in out.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            if !prev_blank {
                result.push('\n');
                prev_blank = true;
            }
        } else {
            result.push_str(trimmed);
            result.push('\n');
            prev_blank = false;
        }
    }
    result.trim().to_string()
}
