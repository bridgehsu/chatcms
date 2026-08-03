use serde::{Deserialize, Serialize};

use super::types::Domain;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionGrant {
    pub session_id: String,
    pub domain: Domain,
    /// 可选：仅匹配该工具名
    pub tool_name: Option<String>,
    /// 可选：MCP server 名
    pub mcp_server: Option<String>,
    pub allow: bool,
}

#[derive(Debug, Default)]
pub struct SessionGrantStore {
    grants: Vec<SessionGrant>,
}

impl SessionGrantStore {
    pub fn clear_session(&mut self, session_id: &str) {
        self.grants.retain(|g| g.session_id != session_id);
    }

    pub fn add(&mut self, grant: SessionGrant) {
        self.grants.retain(|g| {
            !(g.session_id == grant.session_id
                && g.domain == grant.domain
                && g.tool_name == grant.tool_name
                && g.mcp_server == grant.mcp_server)
        });
        self.grants.push(grant);
    }

    pub fn find(
        &self,
        session_id: &str,
        domain: Domain,
        tool_name: &str,
        mcp_server: Option<&str>,
    ) -> Option<&SessionGrant> {
        self.grants.iter().rev().find(|g| {
            if g.session_id != session_id || g.domain != domain {
                return false;
            }
            if let Some(ref t) = g.tool_name {
                if t != tool_name {
                    return false;
                }
            }
            if let Some(ref s) = g.mcp_server {
                if Some(s.as_str()) != mcp_server {
                    return false;
                }
            }
            true
        })
    }

    pub fn list_for_session(&self, session_id: &str) -> Vec<SessionGrant> {
        self.grants
            .iter()
            .filter(|g| g.session_id == session_id)
            .cloned()
            .collect()
    }
}
