import{aD as _t,aE as Dt,r as fe,q as he,H as me,F as ke,t as ye,v as ge,_ as l,g as dt,B as pt,aH as ve,aI as pe,aJ as Te,w as xe,a0 as be,aK as we,aL as q,l as ot,aM as _e,aN as Ht,aO as Bt,aP as De,aQ as Se,aR as Ce,aS as Me,aT as Ee,aU as Ie,aV as Ye,aW as Gt,aX as Xt,aY as jt,aZ as Ut,a_ as qt,a$ as $e,D as Le,a6 as Ae,I as Fe,P as Oe}from"./theme.DNQnOeL0.js";import"./framework.D66Xq0Kv.js";var Jt={exports:{}};(function(t,i){(function(r,e){t.exports=e()})(_t,function(){var r="day";return function(e,a,g){var v=function(A){return A.add(4-A.isoWeekday(),r)},b=a.prototype;b.isoWeekYear=function(){return v(this).year()},b.isoWeek=function(A){if(!this.$utils().u(A))return this.add(7*(A-this.isoWeek()),r);var w,P,F,R,j=v(this),z=(w=this.isoWeekYear(),P=this.$u,F=(P?g.utc:g)().year(w).startOf("year"),R=4-F.isoWeekday(),F.isoWeekday()>4&&(R+=7),F.add(R,r));return j.diff(z,"week")+1},b.isoWeekday=function(A){return this.$utils().u(A)?this.day()||7:this.day(this.day()%7?A:A-7)};var L=b.startOf;b.startOf=function(A,w){var P=this.$utils(),F=!!P.u(w)||w;return P.p(A)==="isoweek"?F?this.date(this.date()-(this.isoWeekday()-1)).startOf("day"):this.date(this.date()-1-(this.isoWeekday()-1)+7).endOf("day"):L.bind(this)(A,w)}}})})(Jt);var We=Jt.exports;const Pe=Dt(We);var te={exports:{}};(function(t,i){(function(r,e){t.exports=e()})(_t,function(){var r={LTS:"h:mm:ss A",LT:"h:mm A",L:"MM/DD/YYYY",LL:"MMMM D, YYYY",LLL:"MMMM D, YYYY h:mm A",LLLL:"dddd, MMMM D, YYYY h:mm A"},e=/(\[[^[]*\])|([-_:/.,()\s]+)|(A|a|Q|YYYY|YY?|ww?|MM?M?M?|Do|DD?|hh?|HH?|mm?|ss?|S{1,3}|z|ZZ?)/g,a=/\d/,g=/\d\d/,v=/\d\d?/,b=/\d*[^-_:/,()\s\d]+/,L={},A=function(k){return(k=+k)+(k>68?1900:2e3)},w=function(k){return function(E){this[k]=+E}},P=[/[+-]\d\d:?(\d\d)?|Z/,function(k){(this.zone||(this.zone={})).offset=function(E){if(!E||E==="Z")return 0;var O=E.match(/([+-]|\d\d)/g),$=60*O[1]+(+O[2]||0);return $===0?0:O[0]==="+"?-$:$}(k)}],F=function(k){var E=L[k];return E&&(E.indexOf?E:E.s.concat(E.f))},R=function(k,E){var O,$=L.meridiem;if($){for(var U=1;U<=24;U+=1)if(k.indexOf($(U,0,E))>-1){O=U>12;break}}else O=k===(E?"pm":"PM");return O},j={A:[b,function(k){this.afternoon=R(k,!1)}],a:[b,function(k){this.afternoon=R(k,!0)}],Q:[a,function(k){this.month=3*(k-1)+1}],S:[a,function(k){this.milliseconds=100*+k}],SS:[g,function(k){this.milliseconds=10*+k}],SSS:[/\d{3}/,function(k){this.milliseconds=+k}],s:[v,w("seconds")],ss:[v,w("seconds")],m:[v,w("minutes")],mm:[v,w("minutes")],H:[v,w("hours")],h:[v,w("hours")],HH:[v,w("hours")],hh:[v,w("hours")],D:[v,w("day")],DD:[g,w("day")],Do:[b,function(k){var E=L.ordinal,O=k.match(/\d+/);if(this.day=O[0],E)for(var $=1;$<=31;$+=1)E($).replace(/\[|\]/g,"")===k&&(this.day=$)}],w:[v,w("week")],ww:[g,w("week")],M:[v,w("month")],MM:[g,w("month")],MMM:[b,function(k){var E=F("months"),O=(F("monthsShort")||E.map(function($){return $.slice(0,3)})).indexOf(k)+1;if(O<1)throw new Error;this.month=O%12||O}],MMMM:[b,function(k){var E=F("months").indexOf(k)+1;if(E<1)throw new Error;this.month=E%12||E}],Y:[/[+-]?\d+/,w("year")],YY:[g,function(k){this.year=A(k)}],YYYY:[/\d{4}/,w("year")],Z:P,ZZ:P};function z(k){var E,O;E=k,O=L&&L.formats;for(var $=(k=E.replace(/(\[[^\]]+])|(LTS?|l{1,4}|L{1,4})/g,function(m,T,p){var y=p&&p.toUpperCase();return T||O[p]||r[p]||O[y].replace(/(\[[^\]]+])|(MMMM|MM|DD|dddd)/g,function(n,d,f){return d||f.slice(1)})})).match(e),U=$.length,B=0;B<U;B+=1){var Y=$[B],x=j[Y],h=x&&x[0],I=x&&x[1];$[B]=I?{regex:h,parser:I}:Y.replace(/^\[|\]$/g,"")}return function(m){for(var T={},p=0,y=0;p<U;p+=1){var n=$[p];if(typeof n=="string")y+=n.length;else{var d=n.regex,f=n.parser,u=m.slice(y),_=d.exec(u)[0];f.call(T,_),m=m.replace(_,"")}}return function(s){var D=s.afternoon;if(D!==void 0){var o=s.hours;D?o<12&&(s.hours+=12):o===12&&(s.hours=0),delete s.afternoon}}(T),T}}return function(k,E,O){O.p.customParseFormat=!0,k&&k.parseTwoDigitYear&&(A=k.parseTwoDigitYear);var $=E.prototype,U=$.parse;$.parse=function(B){var Y=B.date,x=B.utc,h=B.args;this.$u=x;var I=h[1];if(typeof I=="string"){var m=h[2]===!0,T=h[3]===!0,p=m||T,y=h[2];T&&(y=h[2]),L=this.$locale(),!m&&y&&(L=O.Ls[y]),this.$d=function(u,_,s,D){try{if(["x","X"].indexOf(_)>-1)return new Date((_==="X"?1e3:1)*u);var o=z(_)(u),H=o.year,c=o.month,S=o.day,C=o.hours,V=o.minutes,M=o.seconds,N=o.milliseconds,W=o.zone,it=o.week,nt=new Date,yt=S||(H||c?1:nt.getDate()),lt=H||nt.getFullYear(),G=0;H&&!c||(G=c>0?c-1:nt.getMonth());var K,Z=C||0,at=V||0,J=M||0,rt=N||0;return W?new Date(Date.UTC(lt,G,yt,Z,at,J,rt+60*W.offset*1e3)):s?new Date(Date.UTC(lt,G,yt,Z,at,J,rt)):(K=new Date(lt,G,yt,Z,at,J,rt),it&&(K=D(K).week(it).toDate()),K)}catch{return new Date("")}}(Y,I,x,O),this.init(),y&&y!==!0&&(this.$L=this.locale(y).$L),p&&Y!=this.format(I)&&(this.$d=new Date("")),L={}}else if(I instanceof Array)for(var n=I.length,d=1;d<=n;d+=1){h[1]=I[d-1];var f=O.apply(this,h);if(f.isValid()){this.$d=f.$d,this.$L=f.$L,this.init();break}d===n&&(this.$d=new Date(""))}else U.call(this,B)}}})})(te);var Ve=te.exports;const Re=Dt(Ve);var ee={exports:{}};(function(t,i){(function(r,e){t.exports=e()})(_t,function(){return function(r,e){var a=e.prototype,g=a.format;a.format=function(v){var b=this,L=this.$locale();if(!this.isValid())return g.bind(this)(v);var A=this.$utils(),w=(v||"YYYY-MM-DDTHH:mm:ssZ").replace(/\[([^\]]+)]|Q|wo|ww|w|WW|W|zzz|z|gggg|GGGG|Do|X|x|k{1,2}|S/g,function(P){switch(P){case"Q":return Math.ceil((b.$M+1)/3);case"Do":return L.ordinal(b.$D);case"gggg":return b.weekYear();case"GGGG":return b.isoWeekYear();case"wo":return L.ordinal(b.week(),"W");case"w":case"ww":return A.s(b.week(),P==="w"?1:2,"0");case"W":case"WW":return A.s(b.isoWeek(),P==="W"?1:2,"0");case"k":case"kk":return A.s(String(b.$H===0?24:b.$H),P==="k"?1:2,"0");case"X":return Math.floor(b.$d.getTime()/1e3);case"x":return b.$d.getTime();case"z":return"["+b.offsetName()+"]";case"zzz":return"["+b.offsetName("long")+"]";default:return P}});return g.bind(this)(w)}}})})(ee);var Ne=ee.exports;const ze=Dt(Ne);var se={exports:{}};(function(t,i){(function(r,e){t.exports=e()})(_t,function(){var r,e,a=1e3,g=6e4,v=36e5,b=864e5,L=31536e6,A=2628e6,w=/^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/,P=/\[([^\]]+)]|YYYY|YY|Y|M{1,2}|D{1,2}|H{1,2}|m{1,2}|s{1,2}|SSS/g,F={years:L,months:A,days:b,hours:v,minutes:g,seconds:a,milliseconds:1,weeks:6048e5},R=function(Y){return Y instanceof U},j=function(Y,x,h){return new U(Y,h,x.$l)},z=function(Y){return e.p(Y)+"s"},k=function(Y){return Y<0},E=function(Y){return k(Y)?Math.ceil(Y):Math.floor(Y)},O=function(Y){return Math.abs(Y)},$=function(Y,x){return Y?k(Y)?{negative:!0,format:""+O(Y)+x}:{negative:!1,format:""+Y+x}:{negative:!1,format:""}},U=function(){function Y(h,I,m){var T=this;if(this.$d={},this.$l=m,h===void 0&&(this.$ms=0,this.parseFromMilliseconds()),I)return j(h*F[z(I)],this);if(typeof h=="number")return this.$ms=h,this.parseFromMilliseconds(),this;if(typeof h=="object")return Object.keys(h).forEach(function(n){T.$d[z(n)]=h[n]}),this.calMilliseconds(),this;if(typeof h=="string"){var p=h.match(w);if(p){var y=p.slice(2).map(function(n){return n!=null?Number(n):0});return this.$d.years=y[0],this.$d.months=y[1],this.$d.weeks=y[2],this.$d.days=y[3],this.$d.hours=y[4],this.$d.minutes=y[5],this.$d.seconds=y[6],this.calMilliseconds(),this}}return this}var x=Y.prototype;return x.calMilliseconds=function(){var h=this;this.$ms=Object.keys(this.$d).reduce(function(I,m){return I+(h.$d[m]||0)*F[m]},0)},x.parseFromMilliseconds=function(){var h=this.$ms;this.$d.years=E(h/L),h%=L,this.$d.months=E(h/A),h%=A,this.$d.days=E(h/b),h%=b,this.$d.hours=E(h/v),h%=v,this.$d.minutes=E(h/g),h%=g,this.$d.seconds=E(h/a),h%=a,this.$d.milliseconds=h},x.toISOString=function(){var h=$(this.$d.years,"Y"),I=$(this.$d.months,"M"),m=+this.$d.days||0;this.$d.weeks&&(m+=7*this.$d.weeks);var T=$(m,"D"),p=$(this.$d.hours,"H"),y=$(this.$d.minutes,"M"),n=this.$d.seconds||0;this.$d.milliseconds&&(n+=this.$d.milliseconds/1e3,n=Math.round(1e3*n)/1e3);var d=$(n,"S"),f=h.negative||I.negative||T.negative||p.negative||y.negative||d.negative,u=p.format||y.format||d.format?"T":"",_=(f?"-":"")+"P"+h.format+I.format+T.format+u+p.format+y.format+d.format;return _==="P"||_==="-P"?"P0D":_},x.toJSON=function(){return this.toISOString()},x.format=function(h){var I=h||"YYYY-MM-DDTHH:mm:ss",m={Y:this.$d.years,YY:e.s(this.$d.years,2,"0"),YYYY:e.s(this.$d.years,4,"0"),M:this.$d.months,MM:e.s(this.$d.months,2,"0"),D:this.$d.days,DD:e.s(this.$d.days,2,"0"),H:this.$d.hours,HH:e.s(this.$d.hours,2,"0"),m:this.$d.minutes,mm:e.s(this.$d.minutes,2,"0"),s:this.$d.seconds,ss:e.s(this.$d.seconds,2,"0"),SSS:e.s(this.$d.milliseconds,3,"0")};return I.replace(P,function(T,p){return p||String(m[T])})},x.as=function(h){return this.$ms/F[z(h)]},x.get=function(h){var I=this.$ms,m=z(h);return m==="milliseconds"?I%=1e3:I=m==="weeks"?E(I/F[m]):this.$d[m],I||0},x.add=function(h,I,m){var T;return T=I?h*F[z(I)]:R(h)?h.$ms:j(h,this).$ms,j(this.$ms+T*(m?-1:1),this)},x.subtract=function(h,I){return this.add(h,I,!0)},x.locale=function(h){var I=this.clone();return I.$l=h,I},x.clone=function(){return j(this.$ms,this)},x.humanize=function(h){return r().add(this.$ms,"ms").locale(this.$l).fromNow(!h)},x.valueOf=function(){return this.asMilliseconds()},x.milliseconds=function(){return this.get("milliseconds")},x.asMilliseconds=function(){return this.as("milliseconds")},x.seconds=function(){return this.get("seconds")},x.asSeconds=function(){return this.as("seconds")},x.minutes=function(){return this.get("minutes")},x.asMinutes=function(){return this.as("minutes")},x.hours=function(){return this.get("hours")},x.asHours=function(){return this.as("hours")},x.days=function(){return this.get("days")},x.asDays=function(){return this.as("days")},x.weeks=function(){return this.get("weeks")},x.asWeeks=function(){return this.as("weeks")},x.months=function(){return this.get("months")},x.asMonths=function(){return this.as("months")},x.years=function(){return this.get("years")},x.asYears=function(){return this.as("years")},Y}(),B=function(Y,x,h){return Y.add(x.years()*h,"y").add(x.months()*h,"M").add(x.days()*h,"d").add(x.hours()*h,"h").add(x.minutes()*h,"m").add(x.seconds()*h,"s").add(x.milliseconds()*h,"ms")};return function(Y,x,h){r=h,e=h().$utils(),h.duration=function(T,p){var y=h.locale();return j(T,{$l:y},p)},h.isDuration=R;var I=x.prototype.add,m=x.prototype.subtract;x.prototype.add=function(T,p){return R(T)?B(this,T,1):I.bind(this)(T,p)},x.prototype.subtract=function(T,p){return R(T)?B(this,T,-1):m.bind(this)(T,p)}}})})(se);var He=se.exports;const Be=Dt(He);var Mt=function(){var t=l(function(y,n,d,f){for(d=d||{},f=y.length;f--;d[y[f]]=n);return d},"o"),i=[6,8,10,12,13,14,15,16,17,18,20,21,22,23,24,25,26,27,28,29,30,31,33,35,36,38,40],r=[1,26],e=[1,27],a=[1,28],g=[1,29],v=[1,30],b=[1,31],L=[1,32],A=[1,33],w=[1,34],P=[1,9],F=[1,10],R=[1,11],j=[1,12],z=[1,13],k=[1,14],E=[1,15],O=[1,16],$=[1,19],U=[1,20],B=[1,21],Y=[1,22],x=[1,23],h=[1,25],I=[1,35],m={trace:l(function(){},"trace"),yy:{},symbols_:{error:2,start:3,gantt:4,document:5,EOF:6,line:7,SPACE:8,statement:9,NL:10,weekday:11,weekday_monday:12,weekday_tuesday:13,weekday_wednesday:14,weekday_thursday:15,weekday_friday:16,weekday_saturday:17,weekday_sunday:18,weekend:19,weekend_friday:20,weekend_saturday:21,dateFormat:22,inclusiveEndDates:23,topAxis:24,axisFormat:25,tickInterval:26,excludes:27,includes:28,todayMarker:29,title:30,acc_title:31,acc_title_value:32,acc_descr:33,acc_descr_value:34,acc_descr_multiline_value:35,section:36,clickStatement:37,taskTxt:38,taskData:39,click:40,callbackname:41,callbackargs:42,href:43,clickStatementDebug:44,$accept:0,$end:1},terminals_:{2:"error",4:"gantt",6:"EOF",8:"SPACE",10:"NL",12:"weekday_monday",13:"weekday_tuesday",14:"weekday_wednesday",15:"weekday_thursday",16:"weekday_friday",17:"weekday_saturday",18:"weekday_sunday",20:"weekend_friday",21:"weekend_saturday",22:"dateFormat",23:"inclusiveEndDates",24:"topAxis",25:"axisFormat",26:"tickInterval",27:"excludes",28:"includes",29:"todayMarker",30:"title",31:"acc_title",32:"acc_title_value",33:"acc_descr",34:"acc_descr_value",35:"acc_descr_multiline_value",36:"section",38:"taskTxt",39:"taskData",40:"click",41:"callbackname",42:"callbackargs",43:"href"},productions_:[0,[3,3],[5,0],[5,2],[7,2],[7,1],[7,1],[7,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[19,1],[19,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,2],[9,2],[9,1],[9,1],[9,1],[9,2],[37,2],[37,3],[37,3],[37,4],[37,3],[37,4],[37,2],[44,2],[44,3],[44,3],[44,4],[44,3],[44,4],[44,2]],performAction:l(function(n,d,f,u,_,s,D){var o=s.length-1;switch(_){case 1:return s[o-1];case 2:this.$=[];break;case 3:s[o-1].push(s[o]),this.$=s[o-1];break;case 4:case 5:this.$=s[o];break;case 6:case 7:this.$=[];break;case 8:u.setWeekday("monday");break;case 9:u.setWeekday("tuesday");break;case 10:u.setWeekday("wednesday");break;case 11:u.setWeekday("thursday");break;case 12:u.setWeekday("friday");break;case 13:u.setWeekday("saturday");break;case 14:u.setWeekday("sunday");break;case 15:u.setWeekend("friday");break;case 16:u.setWeekend("saturday");break;case 17:u.setDateFormat(s[o].substr(11)),this.$=s[o].substr(11);break;case 18:u.enableInclusiveEndDates(),this.$=s[o].substr(18);break;case 19:u.TopAxis(),this.$=s[o].substr(8);break;case 20:u.setAxisFormat(s[o].substr(11)),this.$=s[o].substr(11);break;case 21:u.setTickInterval(s[o].substr(13)),this.$=s[o].substr(13);break;case 22:u.setExcludes(s[o].substr(9)),this.$=s[o].substr(9);break;case 23:u.setIncludes(s[o].substr(9)),this.$=s[o].substr(9);break;case 24:u.setTodayMarker(s[o].substr(12)),this.$=s[o].substr(12);break;case 27:u.setDiagramTitle(s[o].substr(6)),this.$=s[o].substr(6);break;case 28:this.$=s[o].trim(),u.setAccTitle(this.$);break;case 29:case 30:this.$=s[o].trim(),u.setAccDescription(this.$);break;case 31:u.addSection(s[o].substr(8)),this.$=s[o].substr(8);break;case 33:u.addTask(s[o-1],s[o]),this.$="task";break;case 34:this.$=s[o-1],u.setClickEvent(s[o-1],s[o],null);break;case 35:this.$=s[o-2],u.setClickEvent(s[o-2],s[o-1],s[o]);break;case 36:this.$=s[o-2],u.setClickEvent(s[o-2],s[o-1],null),u.setLink(s[o-2],s[o]);break;case 37:this.$=s[o-3],u.setClickEvent(s[o-3],s[o-2],s[o-1]),u.setLink(s[o-3],s[o]);break;case 38:this.$=s[o-2],u.setClickEvent(s[o-2],s[o],null),u.setLink(s[o-2],s[o-1]);break;case 39:this.$=s[o-3],u.setClickEvent(s[o-3],s[o-1],s[o]),u.setLink(s[o-3],s[o-2]);break;case 40:this.$=s[o-1],u.setLink(s[o-1],s[o]);break;case 41:case 47:this.$=s[o-1]+" "+s[o];break;case 42:case 43:case 45:this.$=s[o-2]+" "+s[o-1]+" "+s[o];break;case 44:case 46:this.$=s[o-3]+" "+s[o-2]+" "+s[o-1]+" "+s[o];break}},"anonymous"),table:[{3:1,4:[1,2]},{1:[3]},t(i,[2,2],{5:3}),{6:[1,4],7:5,8:[1,6],9:7,10:[1,8],11:17,12:r,13:e,14:a,15:g,16:v,17:b,18:L,19:18,20:A,21:w,22:P,23:F,24:R,25:j,26:z,27:k,28:E,29:O,30:$,31:U,33:B,35:Y,36:x,37:24,38:h,40:I},t(i,[2,7],{1:[2,1]}),t(i,[2,3]),{9:36,11:17,12:r,13:e,14:a,15:g,16:v,17:b,18:L,19:18,20:A,21:w,22:P,23:F,24:R,25:j,26:z,27:k,28:E,29:O,30:$,31:U,33:B,35:Y,36:x,37:24,38:h,40:I},t(i,[2,5]),t(i,[2,6]),t(i,[2,17]),t(i,[2,18]),t(i,[2,19]),t(i,[2,20]),t(i,[2,21]),t(i,[2,22]),t(i,[2,23]),t(i,[2,24]),t(i,[2,25]),t(i,[2,26]),t(i,[2,27]),{32:[1,37]},{34:[1,38]},t(i,[2,30]),t(i,[2,31]),t(i,[2,32]),{39:[1,39]},t(i,[2,8]),t(i,[2,9]),t(i,[2,10]),t(i,[2,11]),t(i,[2,12]),t(i,[2,13]),t(i,[2,14]),t(i,[2,15]),t(i,[2,16]),{41:[1,40],43:[1,41]},t(i,[2,4]),t(i,[2,28]),t(i,[2,29]),t(i,[2,33]),t(i,[2,34],{42:[1,42],43:[1,43]}),t(i,[2,40],{41:[1,44]}),t(i,[2,35],{43:[1,45]}),t(i,[2,36]),t(i,[2,38],{42:[1,46]}),t(i,[2,37]),t(i,[2,39])],defaultActions:{},parseError:l(function(n,d){if(d.recoverable)this.trace(n);else{var f=new Error(n);throw f.hash=d,f}},"parseError"),parse:l(function(n){var d=this,f=[0],u=[],_=[null],s=[],D=this.table,o="",H=0,c=0,S=2,C=1,V=s.slice.call(arguments,1),M=Object.create(this.lexer),N={yy:{}};for(var W in this.yy)Object.prototype.hasOwnProperty.call(this.yy,W)&&(N.yy[W]=this.yy[W]);M.setInput(n,N.yy),N.yy.lexer=M,N.yy.parser=this,typeof M.yylloc>"u"&&(M.yylloc={});var it=M.yylloc;s.push(it);var nt=M.options&&M.options.ranges;typeof N.yy.parseError=="function"?this.parseError=N.yy.parseError:this.parseError=Object.getPrototypeOf(this).parseError;function yt(Q){f.length=f.length-2*Q,_.length=_.length-Q,s.length=s.length-Q}l(yt,"popStack");function lt(){var Q;return Q=u.pop()||M.lex()||C,typeof Q!="number"&&(Q instanceof Array&&(u=Q,Q=u.pop()),Q=d.symbols_[Q]||Q),Q}l(lt,"lex");for(var G,K,Z,at,J={},rt,tt,zt,vt;;){if(K=f[f.length-1],this.defaultActions[K]?Z=this.defaultActions[K]:((G===null||typeof G>"u")&&(G=lt()),Z=D[K]&&D[K][G]),typeof Z>"u"||!Z.length||!Z[0]){var St="";vt=[];for(rt in D[K])this.terminals_[rt]&&rt>S&&vt.push("'"+this.terminals_[rt]+"'");M.showPosition?St="Parse error on line "+(H+1)+`:
`+M.showPosition()+`
Expecting `+vt.join(", ")+", got '"+(this.terminals_[G]||G)+"'":St="Parse error on line "+(H+1)+": Unexpected "+(G==C?"end of input":"'"+(this.terminals_[G]||G)+"'"),this.parseError(St,{text:M.match,token:this.terminals_[G]||G,line:M.yylineno,loc:it,expected:vt})}if(Z[0]instanceof Array&&Z.length>1)throw new Error("Parse Error: multiple actions possible at state: "+K+", token: "+G);switch(Z[0]){case 1:f.push(G),_.push(M.yytext),s.push(M.yylloc),f.push(Z[1]),G=null,c=M.yyleng,o=M.yytext,H=M.yylineno,it=M.yylloc;break;case 2:if(tt=this.productions_[Z[1]][1],J.$=_[_.length-tt],J._$={first_line:s[s.length-(tt||1)].first_line,last_line:s[s.length-1].last_line,first_column:s[s.length-(tt||1)].first_column,last_column:s[s.length-1].last_column},nt&&(J._$.range=[s[s.length-(tt||1)].range[0],s[s.length-1].range[1]]),at=this.performAction.apply(J,[o,c,H,N.yy,Z[1],_,s].concat(V)),typeof at<"u")return at;tt&&(f=f.slice(0,-1*tt*2),_=_.slice(0,-1*tt),s=s.slice(0,-1*tt)),f.push(this.productions_[Z[1]][0]),_.push(J.$),s.push(J._$),zt=D[f[f.length-2]][f[f.length-1]],f.push(zt);break;case 3:return!0}}return!0},"parse")},T=function(){var y={EOF:1,parseError:l(function(d,f){if(this.yy.parser)this.yy.parser.parseError(d,f);else throw new Error(d)},"parseError"),setInput:l(function(n,d){return this.yy=d||this.yy||{},this._input=n,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:l(function(){var n=this._input[0];this.yytext+=n,this.yyleng++,this.offset++,this.match+=n,this.matched+=n;var d=n.match(/(?:\r\n?|\n).*/g);return d?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),n},"input"),unput:l(function(n){var d=n.length,f=n.split(/(?:\r\n?|\n)/g);this._input=n+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-d),this.offset-=d;var u=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),f.length-1&&(this.yylineno-=f.length-1);var _=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:f?(f.length===u.length?this.yylloc.first_column:0)+u[u.length-f.length].length-f[0].length:this.yylloc.first_column-d},this.options.ranges&&(this.yylloc.range=[_[0],_[0]+this.yyleng-d]),this.yyleng=this.yytext.length,this},"unput"),more:l(function(){return this._more=!0,this},"more"),reject:l(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:"",token:null,line:this.yylineno});return this},"reject"),less:l(function(n){this.unput(this.match.slice(n))},"less"),pastInput:l(function(){var n=this.matched.substr(0,this.matched.length-this.match.length);return(n.length>20?"...":"")+n.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:l(function(){var n=this.match;return n.length<20&&(n+=this._input.substr(0,20-n.length)),(n.substr(0,20)+(n.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:l(function(){var n=this.pastInput(),d=new Array(n.length+1).join("-");return n+this.upcomingInput()+`
`+d+"^"},"showPosition"),test_match:l(function(n,d){var f,u,_;if(this.options.backtrack_lexer&&(_={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(_.yylloc.range=this.yylloc.range.slice(0))),u=n[0].match(/(?:\r\n?|\n).*/g),u&&(this.yylineno+=u.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:u?u[u.length-1].length-u[u.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+n[0].length},this.yytext+=n[0],this.match+=n[0],this.matches=n,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(n[0].length),this.matched+=n[0],f=this.performAction.call(this,this.yy,this,d,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),f)return f;if(this._backtrack){for(var s in _)this[s]=_[s];return!1}return!1},"test_match"),next:l(function(){if(this.done)return this.EOF;this._input||(this.done=!0);var n,d,f,u;this._more||(this.yytext="",this.match="");for(var _=this._currentRules(),s=0;s<_.length;s++)if(f=this._input.match(this.rules[_[s]]),f&&(!d||f[0].length>d[0].length)){if(d=f,u=s,this.options.backtrack_lexer){if(n=this.test_match(f,_[s]),n!==!1)return n;if(this._backtrack){d=!1;continue}else return!1}else if(!this.options.flex)break}return d?(n=this.test_match(d,_[u]),n!==!1?n:!1):this._input===""?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:l(function(){var d=this.next();return d||this.lex()},"lex"),begin:l(function(d){this.conditionStack.push(d)},"begin"),popState:l(function(){var d=this.conditionStack.length-1;return d>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),_currentRules:l(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),topState:l(function(d){return d=this.conditionStack.length-1-Math.abs(d||0),d>=0?this.conditionStack[d]:"INITIAL"},"topState"),pushState:l(function(d){this.begin(d)},"pushState"),stateStackSize:l(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:l(function(d,f,u,_){switch(u){case 0:return this.begin("open_directive"),"open_directive";case 1:return this.begin("acc_title"),31;case 2:return this.popState(),"acc_title_value";case 3:return this.begin("acc_descr"),33;case 4:return this.popState(),"acc_descr_value";case 5:this.begin("acc_descr_multiline");break;case 6:this.popState();break;case 7:return"acc_descr_multiline_value";case 8:break;case 9:break;case 10:break;case 11:return 10;case 12:break;case 13:break;case 14:this.begin("href");break;case 15:this.popState();break;case 16:return 43;case 17:this.begin("callbackname");break;case 18:this.popState();break;case 19:this.popState(),this.begin("callbackargs");break;case 20:return 41;case 21:this.popState();break;case 22:return 42;case 23:this.begin("click");break;case 24:this.popState();break;case 25:return 40;case 26:return 4;case 27:return 22;case 28:return 23;case 29:return 24;case 30:return 25;case 31:return 26;case 32:return 28;case 33:return 27;case 34:return 29;case 35:return 12;case 36:return 13;case 37:return 14;case 38:return 15;case 39:return 16;case 40:return 17;case 41:return 18;case 42:return 20;case 43:return 21;case 44:return"date";case 45:return 30;case 46:return"accDescription";case 47:return 36;case 48:return 38;case 49:return 39;case 50:return":";case 51:return 6;case 52:return"INVALID"}},"anonymous"),rules:[/^(?:%%\{)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:%%(?!\{)*[^\n]*)/i,/^(?:[^\}]%%*[^\n]*)/i,/^(?:%%*[^\n]*[\n]*)/i,/^(?:[\n]+)/i,/^(?:\s+)/i,/^(?:%[^\n]*)/i,/^(?:href[\s]+["])/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:call[\s]+)/i,/^(?:\([\s]*\))/i,/^(?:\()/i,/^(?:[^(]*)/i,/^(?:\))/i,/^(?:[^)]*)/i,/^(?:click[\s]+)/i,/^(?:[\s\n])/i,/^(?:[^\s\n]*)/i,/^(?:gantt\b)/i,/^(?:dateFormat\s[^#\n;]+)/i,/^(?:inclusiveEndDates\b)/i,/^(?:topAxis\b)/i,/^(?:axisFormat\s[^#\n;]+)/i,/^(?:tickInterval\s[^#\n;]+)/i,/^(?:includes\s[^#\n;]+)/i,/^(?:excludes\s[^#\n;]+)/i,/^(?:todayMarker\s[^\n;]+)/i,/^(?:weekday\s+monday\b)/i,/^(?:weekday\s+tuesday\b)/i,/^(?:weekday\s+wednesday\b)/i,/^(?:weekday\s+thursday\b)/i,/^(?:weekday\s+friday\b)/i,/^(?:weekday\s+saturday\b)/i,/^(?:weekday\s+sunday\b)/i,/^(?:weekend\s+friday\b)/i,/^(?:weekend\s+saturday\b)/i,/^(?:\d\d\d\d-\d\d-\d\d\b)/i,/^(?:title\s[^\n]+)/i,/^(?:accDescription\s[^#\n;]+)/i,/^(?:section\s[^\n]+)/i,/^(?:[^:\n]+)/i,/^(?::[^#\n;]+)/i,/^(?::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{acc_descr_multiline:{rules:[6,7],inclusive:!1},acc_descr:{rules:[4],inclusive:!1},acc_title:{rules:[2],inclusive:!1},callbackargs:{rules:[21,22],inclusive:!1},callbackname:{rules:[18,19,20],inclusive:!1},href:{rules:[15,16],inclusive:!1},click:{rules:[24,25],inclusive:!1},INITIAL:{rules:[0,1,3,5,8,9,10,11,12,13,14,17,23,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52],inclusive:!0}}};return y}();m.lexer=T;function p(){this.yy={}}return l(p,"Parser"),p.prototype=m,m.Parser=p,new p}();Mt.parser=Mt;var Ge=Mt;q.extend(Pe);q.extend(Re);q.extend(ze);var Zt={friday:5,saturday:6},et="",$t="",Lt=void 0,At="",ht=[],mt=[],Ft=new Map,Ot=[],bt=[],kt="",Wt="",ie=["active","done","crit","milestone","vert"],Pt=[],ut="",gt=!1,Vt=!1,Rt="sunday",wt="saturday",Et=0,Xe=l(function(){Ot=[],bt=[],kt="",Pt=[],Tt=0,Yt=void 0,xt=void 0,X=[],et="",$t="",Wt="",Lt=void 0,At="",ht=[],mt=[],gt=!1,Vt=!1,Et=0,Ft=new Map,ut="",Fe(),Rt="sunday",wt="saturday"},"clear"),je=l(function(t){ut=t},"setDiagramId"),Ue=l(function(t){$t=t},"setAxisFormat"),qe=l(function(){return $t},"getAxisFormat"),Ze=l(function(t){Lt=t},"setTickInterval"),Qe=l(function(){return Lt},"getTickInterval"),Ke=l(function(t){At=t},"setTodayMarker"),Je=l(function(){return At},"getTodayMarker"),ts=l(function(t){et=t},"setDateFormat"),es=l(function(){gt=!0},"enableInclusiveEndDates"),ss=l(function(){return gt},"endDatesAreInclusive"),is=l(function(){Vt=!0},"enableTopAxis"),rs=l(function(){return Vt},"topAxisEnabled"),ns=l(function(t){Wt=t},"setDisplayMode"),as=l(function(){return Wt},"getDisplayMode"),os=l(function(){return et},"getDateFormat"),re=l((t,i)=>{const r=i.toLowerCase().split(/[\s,]+/).filter(e=>e!=="");return[...new Set([...t,...r])]},"mergeTokens"),cs=l(function(t){ht=re(ht,t)},"setIncludes"),ls=l(function(){return ht},"getIncludes"),us=l(function(t){mt=re(mt,t)},"setExcludes"),ds=l(function(){return mt},"getExcludes"),fs=l(function(){return Ft},"getLinks"),hs=l(function(t){kt=t,Ot.push(t)},"addSection"),ms=l(function(){return Ot},"getSections"),ks=l(function(){let t=Qt();const i=10;let r=0;for(;!t&&r<i;)t=Qt(),r++;return bt=X,bt},"getTasks"),ne=l(function(t,i,r,e){const a=t.format(i.trim()),g=t.format("YYYY-MM-DD");return e.includes(a)||e.includes(g)?!1:r.includes("weekends")&&(t.isoWeekday()===Zt[wt]||t.isoWeekday()===Zt[wt]+1)||r.includes(t.format("dddd").toLowerCase())?!0:r.includes(a)||r.includes(g)},"isInvalidDate"),ys=l(function(t){Rt=t},"setWeekday"),gs=l(function(){return Rt},"getWeekday"),vs=l(function(t){wt=t},"setWeekend"),ae=l(function(t,i,r,e){if(!r.length||t.manualEndTime)return;let a;t.startTime instanceof Date?a=q(t.startTime):a=q(t.startTime,i,!0),a=a.add(1,"d");let g;t.endTime instanceof Date?g=q(t.endTime):g=q(t.endTime,i,!0);const[v,b]=ps(a,g,i,r,e);t.endTime=v.toDate(),t.renderEndTime=b},"checkTaskDates"),ps=l(function(t,i,r,e,a){let g=!1,v=null;const b=i.add(1e4,"d");for(;t<=i;){if(g||(v=i.toDate()),g=ne(t,r,e,a),g&&(i=i.add(1,"d"),i>b))throw new Error("Failed to find a valid date that was not excluded by `excludes` after 10,000 iterations.");t=t.add(1,"d")}return[i,v]},"fixTaskDates"),It=l(function(t,i,r){if(r=r.trim(),l(b=>{const L=b.trim();return L==="x"||L==="X"},"isTimestampFormat")(i)&&/^\d+$/.test(r))return new Date(Number(r));const g=/^after\s+(?<ids>[\d\w- ]+)/.exec(r);if(g!==null){let b=null;for(const A of g.groups.ids.split(" ")){let w=ct(A);w!==void 0&&(!b||w.endTime>b.endTime)&&(b=w)}if(b)return b.endTime;const L=new Date;return L.setHours(0,0,0,0),L}let v=q(r,i.trim(),!0);if(v.isValid())return v.toDate();{ot.debug("Invalid date:"+r),ot.debug("With date format:"+i.trim());const b=new Date(r);if(b===void 0||isNaN(b.getTime())||b.getFullYear()<-1e4||b.getFullYear()>1e4)throw new Error("Invalid date:"+r);return b}},"getStartDate"),oe=l(function(t){const i=/^(\d+(?:\.\d+)?)([Mdhmswy]|ms)$/.exec(t.trim());return i!==null?[Number.parseFloat(i[1]),i[2]]:[NaN,"ms"]},"parseDuration"),ce=l(function(t,i,r,e=!1){r=r.trim();const g=/^until\s+(?<ids>[\d\w- ]+)/.exec(r);if(g!==null){let w=null;for(const F of g.groups.ids.split(" ")){let R=ct(F);R!==void 0&&(!w||R.startTime<w.startTime)&&(w=R)}if(w)return w.startTime;const P=new Date;return P.setHours(0,0,0,0),P}let v=q(r,i.trim(),!0);if(v.isValid())return e&&(v=v.add(1,"d")),v.toDate();let b=q(t);const[L,A]=oe(r);if(!Number.isNaN(L)){const w=b.add(L,A);w.isValid()&&(b=w)}return b.toDate()},"getEndDate"),Tt=0,ft=l(function(t){return t===void 0?(Tt=Tt+1,"task"+Tt):t},"parseId"),Ts=l(function(t,i){let r;i.substr(0,1)===":"?r=i.substr(1,i.length):r=i;const e=r.split(","),a={};Nt(e,a,ie);for(let v=0;v<e.length;v++)e[v]=e[v].trim();let g="";switch(e.length){case 1:a.id=ft(),a.startTime=t.endTime,g=e[0];break;case 2:a.id=ft(),a.startTime=It(void 0,et,e[0]),g=e[1];break;case 3:a.id=ft(e[0]),a.startTime=It(void 0,et,e[1]),g=e[2];break}return g&&(a.endTime=ce(a.startTime,et,g,gt),a.manualEndTime=q(g,"YYYY-MM-DD",!0).isValid(),ae(a,et,mt,ht)),a},"compileData"),xs=l(function(t,i){let r;i.substr(0,1)===":"?r=i.substr(1,i.length):r=i;const e=r.split(","),a={};Nt(e,a,ie);for(let g=0;g<e.length;g++)e[g]=e[g].trim();switch(e.length){case 1:a.id=ft(),a.startTime={type:"prevTaskEnd",id:t},a.endTime={data:e[0]};break;case 2:a.id=ft(),a.startTime={type:"getStartDate",startData:e[0]},a.endTime={data:e[1]};break;case 3:a.id=ft(e[0]),a.startTime={type:"getStartDate",startData:e[1]},a.endTime={data:e[2]};break}return a},"parseData"),Yt,xt,X=[],le={},bs=l(function(t,i){const r={section:kt,type:kt,processed:!1,manualEndTime:!1,renderEndTime:null,raw:{data:i},task:t,classes:[]},e=xs(xt,i);r.raw.startTime=e.startTime,r.raw.endTime=e.endTime,r.id=e.id,r.prevTaskId=xt,r.active=e.active,r.done=e.done,r.crit=e.crit,r.milestone=e.milestone,r.vert=e.vert,r.vert?r.order=-1:(r.order=Et,Et++);const a=X.push(r);xt=r.id,le[r.id]=a-1},"addTask"),ct=l(function(t){const i=le[t];return X[i]},"findTaskById"),ws=l(function(t,i){const r={section:kt,type:kt,description:t,task:t,classes:[]},e=Ts(Yt,i);r.startTime=e.startTime,r.endTime=e.endTime,r.id=e.id,r.active=e.active,r.done=e.done,r.crit=e.crit,r.milestone=e.milestone,r.vert=e.vert,Yt=r,bt.push(r)},"addTaskOrg"),Qt=l(function(){const t=l(function(r){const e=X[r];let a="";switch(X[r].raw.startTime.type){case"prevTaskEnd":{const g=ct(e.prevTaskId);e.startTime=g.endTime;break}case"getStartDate":a=It(void 0,et,X[r].raw.startTime.startData),a&&(X[r].startTime=a);break}return X[r].startTime&&(X[r].endTime=ce(X[r].startTime,et,X[r].raw.endTime.data,gt),X[r].endTime&&(X[r].processed=!0,X[r].manualEndTime=q(X[r].raw.endTime.data,"YYYY-MM-DD",!0).isValid(),ae(X[r],et,mt,ht))),X[r].processed},"compileTask");let i=!0;for(const[r,e]of X.entries())t(r),i=i&&e.processed;return i},"compileTasks"),_s=l(function(t,i){let r=i;dt().securityLevel!=="loose"&&(r=Ae(i)),t.split(",").forEach(function(e){ct(e)!==void 0&&(de(e,()=>{window.open(r,"_self")}),Ft.set(e,r))}),ue(t,"clickable")},"setLink"),ue=l(function(t,i){t.split(",").forEach(function(r){let e=ct(r);e!==void 0&&e.classes.push(i)})},"setClass"),Ds=l(function(t,i,r){if(dt().securityLevel!=="loose"||i===void 0)return;let e=[];if(typeof r=="string"){e=r.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);for(let g=0;g<e.length;g++){let v=e[g].trim();v.startsWith('"')&&v.endsWith('"')&&(v=v.substr(1,v.length-2)),e[g]=v}}e.length===0&&e.push(t),ct(t)!==void 0&&de(t,()=>{Oe.runFunc(i,...e)})},"setClickFun"),de=l(function(t,i){Pt.push(function(){const r=ut?`${ut}-${t}`:t,e=document.querySelector(`[id="${r}"]`);e!==null&&e.addEventListener("click",function(){i()})},function(){const r=ut?`${ut}-${t}`:t,e=document.querySelector(`[id="${r}-text"]`);e!==null&&e.addEventListener("click",function(){i()})})},"pushFun"),Ss=l(function(t,i,r){t.split(",").forEach(function(e){Ds(e,i,r)}),ue(t,"clickable")},"setClickEvent"),Cs=l(function(t){Pt.forEach(function(i){i(t)})},"bindFunctions"),Ms={getConfig:l(()=>dt().gantt,"getConfig"),clear:Xe,setDateFormat:ts,getDateFormat:os,enableInclusiveEndDates:es,endDatesAreInclusive:ss,enableTopAxis:is,topAxisEnabled:rs,setAxisFormat:Ue,getAxisFormat:qe,setTickInterval:Ze,getTickInterval:Qe,setTodayMarker:Ke,getTodayMarker:Je,setAccTitle:ge,getAccTitle:ye,setDiagramTitle:ke,getDiagramTitle:me,setDiagramId:je,setDisplayMode:ns,getDisplayMode:as,setAccDescription:he,getAccDescription:fe,addSection:hs,getSections:ms,getTasks:ks,addTask:bs,findTaskById:ct,addTaskOrg:ws,setIncludes:cs,getIncludes:ls,setExcludes:us,getExcludes:ds,setClickEvent:Ss,setLink:_s,getLinks:fs,bindFunctions:Cs,parseDuration:oe,isInvalidDate:ne,setWeekday:ys,getWeekday:gs,setWeekend:vs};function Nt(t,i,r){let e=!0;for(;e;)e=!1,r.forEach(function(a){const g="^\\s*"+a+"\\s*$",v=new RegExp(g);t[0].match(v)&&(i[a]=!0,t.shift(1),e=!0)})}l(Nt,"getTaskTags");q.extend(Be);var Es=l(function(){ot.debug("Something is calling, setConf, remove the call")},"setConf"),Kt={monday:Ye,tuesday:Ie,wednesday:Ee,thursday:Me,friday:Ce,saturday:Se,sunday:De},Is=l((t,i)=>{let r=[...t].map(()=>-1/0),e=[...t].sort((g,v)=>g.startTime-v.startTime||g.order-v.order),a=0;for(const g of e)for(let v=0;v<r.length;v++)if(g.startTime>=r[v]){r[v]=g.endTime,g.order=v+i,v>a&&(a=v);break}return a},"getMaxIntersections"),st,Ct=1e4,Ys=l(function(t,i,r,e){const a=dt().gantt;e.db.setDiagramId(i);const g=dt().securityLevel;let v;g==="sandbox"&&(v=pt("#i"+i));const b=g==="sandbox"?pt(v.nodes()[0].contentDocument.body):pt("body"),L=g==="sandbox"?v.nodes()[0].contentDocument:document,A=L.getElementById(i);st=A.parentElement.offsetWidth,st===void 0&&(st=1200),a.useWidth!==void 0&&(st=a.useWidth);const w=e.db.getTasks(),P=w.filter(m=>!m.vert);let F=[];for(const m of P)F.push(m.type);F=I(F);const R={};let j=2*a.topPadding;if(e.db.getDisplayMode()==="compact"||a.displayMode==="compact"){const m={};for(const p of P)m[p.section]===void 0?m[p.section]=[p]:m[p.section].push(p);let T=0;for(const p of Object.keys(m)){const y=Is(m[p],T)+1;T+=y,j+=y*(a.barHeight+a.barGap),R[p]=y}}else{j+=P.length*(a.barHeight+a.barGap);for(const m of F)R[m]=P.filter(T=>T.type===m).length}A.setAttribute("viewBox","0 0 "+st+" "+j);const z=b.select(`[id="${i}"]`),k=ve().domain([pe(w,function(m){return m.startTime}),Te(w,function(m){return m.endTime})]).rangeRound([0,st-a.leftPadding-a.rightPadding]);function E(m,T){const p=m.startTime,y=T.startTime;let n=0;return p>y?n=1:p<y&&(n=-1),n}l(E,"taskCompare"),w.sort(E),O(w,st,j),xe(z,j,st,a.useMaxWidth),z.append("text").text(e.db.getDiagramTitle()).attr("x",st/2).attr("y",a.titleTopMargin).attr("class","titleText");function O(m,T,p){const y=a.barHeight,n=y+a.barGap,d=a.topPadding,f=a.leftPadding,u=be().domain([0,F.length]).range(["#00B9FA","#F95002"]).interpolate(we);U(n,d,f,T,p,m,e.db.getExcludes(),e.db.getIncludes()),Y(f,d,T,p),$(m,n,d,f,y,u,T),x(n,d),h(f,d,T,p)}l(O,"makeGantt");function $(m,T,p,y,n,d,f){m.sort((c,S)=>c.vert===S.vert?0:c.vert?1:-1);const u=m.filter(c=>!c.vert),s=[...new Set(u.map(c=>c.order))].map(c=>u.find(S=>S.order===c));z.append("g").selectAll("rect").data(s).enter().append("rect").attr("x",0).attr("y",function(c,S){return S=c.order,S*T+p-2}).attr("width",function(){return f-a.rightPadding/2}).attr("height",T).attr("class",function(c){for(const[S,C]of F.entries())if(c.type===C)return"section section"+S%a.numberSectionStyles;return"section section0"}).enter();const D=z.append("g").selectAll("rect").data(m).enter(),o=e.db.getLinks();if(D.append("rect").attr("id",function(c){return i+"-"+c.id}).attr("rx",3).attr("ry",3).attr("x",function(c){return c.milestone?k(c.startTime)+y+.5*(k(c.endTime)-k(c.startTime))-.5*n:k(c.startTime)+y}).attr("y",function(c,S){return S=c.order,c.vert?a.gridLineStartPadding:S*T+p}).attr("width",function(c){return c.milestone?n:c.vert?.08*n:k(c.renderEndTime||c.endTime)-k(c.startTime)}).attr("height",function(c){return c.vert?u.length*(a.barHeight+a.barGap)+a.barHeight*2:n}).attr("transform-origin",function(c,S){return S=c.order,(k(c.startTime)+y+.5*(k(c.endTime)-k(c.startTime))).toString()+"px "+(S*T+p+.5*n).toString()+"px"}).attr("class",function(c){const S="task";let C="";c.classes.length>0&&(C=c.classes.join(" "));let V=0;for(const[N,W]of F.entries())c.type===W&&(V=N%a.numberSectionStyles);let M="";return c.active?c.crit?M+=" activeCrit":M=" active":c.done?c.crit?M=" doneCrit":M=" done":c.crit&&(M+=" crit"),M.length===0&&(M=" task"),c.milestone&&(M=" milestone "+M),c.vert&&(M=" vert "+M),M+=V,M+=" "+C,S+M}),D.append("text").attr("id",function(c){return i+"-"+c.id+"-text"}).text(function(c){return c.task}).attr("font-size",a.fontSize).attr("x",function(c){let S=k(c.startTime),C=k(c.renderEndTime||c.endTime);if(c.milestone&&(S+=.5*(k(c.endTime)-k(c.startTime))-.5*n,C=S+n),c.vert)return k(c.startTime)+y;const V=this.getBBox().width;return V>C-S?C+V+1.5*a.leftPadding>f?S+y-5:C+y+5:(C-S)/2+S+y}).attr("y",function(c,S){return c.vert?a.gridLineStartPadding+u.length*(a.barHeight+a.barGap)+60:(S=c.order,S*T+a.barHeight/2+(a.fontSize/2-2)+p)}).attr("text-height",n).attr("class",function(c){const S=k(c.startTime);let C=k(c.endTime);c.milestone&&(C=S+n);const V=this.getBBox().width;let M="";c.classes.length>0&&(M=c.classes.join(" "));let N=0;for(const[it,nt]of F.entries())c.type===nt&&(N=it%a.numberSectionStyles);let W="";return c.active&&(c.crit?W="activeCritText"+N:W="activeText"+N),c.done?c.crit?W=W+" doneCritText"+N:W=W+" doneText"+N:c.crit&&(W=W+" critText"+N),c.milestone&&(W+=" milestoneText"),c.vert&&(W+=" vertText"),V>C-S?C+V+1.5*a.leftPadding>f?M+" taskTextOutsideLeft taskTextOutside"+N+" "+W:M+" taskTextOutsideRight taskTextOutside"+N+" "+W+" width-"+V:M+" taskText taskText"+N+" "+W+" width-"+V}),dt().securityLevel==="sandbox"){let c;c=pt("#i"+i);const S=c.nodes()[0].contentDocument;D.filter(function(C){return o.has(C.id)}).each(function(C){var V=S.querySelector("#"+CSS.escape(i+"-"+C.id)),M=S.querySelector("#"+CSS.escape(i+"-"+C.id+"-text"));const N=V.parentNode;var W=S.createElement("a");W.setAttribute("xlink:href",o.get(C.id)),W.setAttribute("target","_top"),N.appendChild(W),W.appendChild(V),W.appendChild(M)})}}l($,"drawRects");function U(m,T,p,y,n,d,f,u){if(f.length===0&&u.length===0)return;let _,s;for(const{startTime:C,endTime:V}of d)(_===void 0||C<_)&&(_=C),(s===void 0||V>s)&&(s=V);if(!_||!s)return;if(q(s).diff(q(_),"year")>5){ot.warn("The difference between the min and max time is more than 5 years. This will cause performance issues. Skipping drawing exclude days.");return}const D=e.db.getDateFormat(),o=[];let H=null,c=q(_);for(;c.valueOf()<=s;)e.db.isInvalidDate(c,D,f,u)?H?H.end=c:H={start:c,end:c}:H&&(o.push(H),H=null),c=c.add(1,"d");z.append("g").selectAll("rect").data(o).enter().append("rect").attr("id",C=>i+"-exclude-"+C.start.format("YYYY-MM-DD")).attr("x",C=>k(C.start.startOf("day"))+p).attr("y",a.gridLineStartPadding).attr("width",C=>k(C.end.endOf("day"))-k(C.start.startOf("day"))).attr("height",n-T-a.gridLineStartPadding).attr("transform-origin",function(C,V){return(k(C.start)+p+.5*(k(C.end)-k(C.start))).toString()+"px "+(V*m+.5*n).toString()+"px"}).attr("class","exclude-range")}l(U,"drawExcludeDays");function B(m,T,p,y){if(p<=0||m>T)return 1/0;const n=T-m,d=q.duration({[y??"day"]:p}).asMilliseconds();return d<=0?1/0:Math.ceil(n/d)}l(B,"getEstimatedTickCount");function Y(m,T,p,y){const n=e.db.getDateFormat(),d=e.db.getAxisFormat();let f;d?f=d:n==="D"?f="%d":f=a.axisFormat??"%Y-%m-%d";let u=_e(k).tickSize(-y+T+a.gridLineStartPadding).tickFormat(Ht(f));const s=/^([1-9]\d*)(millisecond|second|minute|hour|day|week|month)$/.exec(e.db.getTickInterval()||a.tickInterval);if(s!==null){const D=parseInt(s[1],10);if(isNaN(D)||D<=0)ot.warn(`Invalid tick interval value: "${s[1]}". Skipping custom tick interval.`);else{const o=s[2],H=e.db.getWeekday()||a.weekday,c=k.domain(),S=c[0],C=c[1],V=B(S,C,D,o);if(V>Ct)ot.warn(`The tick interval "${D}${o}" would generate ${V} ticks, which exceeds the maximum allowed (${Ct}). This may indicate an invalid date or time range. Skipping custom tick interval.`);else switch(o){case"millisecond":u.ticks(qt.every(D));break;case"second":u.ticks(Ut.every(D));break;case"minute":u.ticks(jt.every(D));break;case"hour":u.ticks(Xt.every(D));break;case"day":u.ticks(Gt.every(D));break;case"week":u.ticks(Kt[H].every(D));break;case"month":u.ticks(Bt.every(D));break}}}if(z.append("g").attr("class","grid").attr("transform","translate("+m+", "+(y-50)+")").call(u).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10).attr("dy","1em"),e.db.topAxisEnabled()||a.topAxis){let D=$e(k).tickSize(-y+T+a.gridLineStartPadding).tickFormat(Ht(f));if(s!==null){const o=parseInt(s[1],10);if(isNaN(o)||o<=0)ot.warn(`Invalid tick interval value: "${s[1]}". Skipping custom tick interval.`);else{const H=s[2],c=e.db.getWeekday()||a.weekday,S=k.domain(),C=S[0],V=S[1];if(B(C,V,o,H)<=Ct)switch(H){case"millisecond":D.ticks(qt.every(o));break;case"second":D.ticks(Ut.every(o));break;case"minute":D.ticks(jt.every(o));break;case"hour":D.ticks(Xt.every(o));break;case"day":D.ticks(Gt.every(o));break;case"week":D.ticks(Kt[c].every(o));break;case"month":D.ticks(Bt.every(o));break}}}z.append("g").attr("class","grid").attr("transform","translate("+m+", "+T+")").call(D).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10)}}l(Y,"makeGrid");function x(m,T){let p=0;const y=Object.keys(R).map(n=>[n,R[n]]);z.append("g").selectAll("text").data(y).enter().append(function(n){const d=n[0].split(Le.lineBreakRegex),f=-(d.length-1)/2,u=L.createElementNS("http://www.w3.org/2000/svg","text");u.setAttribute("dy",f+"em");for(const[_,s]of d.entries()){const D=L.createElementNS("http://www.w3.org/2000/svg","tspan");D.setAttribute("alignment-baseline","central"),D.setAttribute("x","10"),_>0&&D.setAttribute("dy","1em"),D.textContent=s,u.appendChild(D)}return u}).attr("x",10).attr("y",function(n,d){if(d>0)for(let f=0;f<d;f++)return p+=y[d-1][1],n[1]*m/2+p*m+T;else return n[1]*m/2+T}).attr("font-size",a.sectionFontSize).attr("class",function(n){for(const[d,f]of F.entries())if(n[0]===f)return"sectionTitle sectionTitle"+d%a.numberSectionStyles;return"sectionTitle"})}l(x,"vertLabels");function h(m,T,p,y){const n=e.db.getTodayMarker();if(n==="off")return;const d=z.append("g").attr("class","today"),f=new Date,u=d.append("line");u.attr("x1",k(f)+m).attr("x2",k(f)+m).attr("y1",a.titleTopMargin).attr("y2",y-a.titleTopMargin).attr("class","today"),n!==""&&u.attr("style",n.replace(/,/g,";"))}l(h,"drawToday");function I(m){const T={},p=[];for(let y=0,n=m.length;y<n;++y)Object.prototype.hasOwnProperty.call(T,m[y])||(T[m[y]]=!0,p.push(m[y]));return p}l(I,"checkUnique")},"draw"),$s={setConf:Es,draw:Ys},Ls=l(t=>`
  .mermaid-main-font {
        font-family: ${t.fontFamily};
  }

  .exclude-range {
    fill: ${t.excludeBkgColor};
  }

  .section {
    stroke: none;
    opacity: 0.2;
  }

  .section0 {
    fill: ${t.sectionBkgColor};
  }

  .section2 {
    fill: ${t.sectionBkgColor2};
  }

  .section1,
  .section3 {
    fill: ${t.altSectionBkgColor};
    opacity: 0.2;
  }

  .sectionTitle0 {
    fill: ${t.titleColor};
  }

  .sectionTitle1 {
    fill: ${t.titleColor};
  }

  .sectionTitle2 {
    fill: ${t.titleColor};
  }

  .sectionTitle3 {
    fill: ${t.titleColor};
  }

  .sectionTitle {
    text-anchor: start;
    font-family: ${t.fontFamily};
  }


  /* Grid and axis */

  .grid .tick {
    stroke: ${t.gridColor};
    opacity: 0.8;
    shape-rendering: crispEdges;
  }

  .grid .tick text {
    font-family: ${t.fontFamily};
    fill: ${t.textColor};
  }

  .grid path {
    stroke-width: 0;
  }


  /* Today line */

  .today {
    fill: none;
    stroke: ${t.todayLineColor};
    stroke-width: 2px;
  }


  /* Task styling */

  /* Default task */

  .task {
    stroke-width: 2;
  }

  .taskText {
    text-anchor: middle;
    font-family: ${t.fontFamily};
  }

  .taskTextOutsideRight {
    fill: ${t.taskTextDarkColor};
    text-anchor: start;
    font-family: ${t.fontFamily};
  }

  .taskTextOutsideLeft {
    fill: ${t.taskTextDarkColor};
    text-anchor: end;
  }


  /* Special case clickable */

  .task.clickable {
    cursor: pointer;
  }

  .taskText.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideLeft.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideRight.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }


  /* Specific task settings for the sections*/

  .taskText0,
  .taskText1,
  .taskText2,
  .taskText3 {
    fill: ${t.taskTextColor};
  }

  .task0,
  .task1,
  .task2,
  .task3 {
    fill: ${t.taskBkgColor};
    stroke: ${t.taskBorderColor};
  }

  .taskTextOutside0,
  .taskTextOutside2
  {
    fill: ${t.taskTextOutsideColor};
  }

  .taskTextOutside1,
  .taskTextOutside3 {
    fill: ${t.taskTextOutsideColor};
  }


  /* Active task */

  .active0,
  .active1,
  .active2,
  .active3 {
    fill: ${t.activeTaskBkgColor};
    stroke: ${t.activeTaskBorderColor};
  }

  .activeText0,
  .activeText1,
  .activeText2,
  .activeText3 {
    fill: ${t.taskTextDarkColor} !important;
  }


  /* Completed task */

  .done0,
  .done1,
  .done2,
  .done3 {
    stroke: ${t.doneTaskBorderColor};
    fill: ${t.doneTaskBkgColor};
    stroke-width: 2;
  }

  .doneText0,
  .doneText1,
  .doneText2,
  .doneText3 {
    fill: ${t.taskTextDarkColor} !important;
  }

  /* Done task text displayed outside the bar sits against the diagram background,
     not against the done-task bar, so it must use the outside/contrast color. */
  .doneText0.taskTextOutsideLeft,
  .doneText0.taskTextOutsideRight,
  .doneText1.taskTextOutsideLeft,
  .doneText1.taskTextOutsideRight,
  .doneText2.taskTextOutsideLeft,
  .doneText2.taskTextOutsideRight,
  .doneText3.taskTextOutsideLeft,
  .doneText3.taskTextOutsideRight {
    fill: ${t.taskTextOutsideColor} !important;
  }


  /* Tasks on the critical line */

  .crit0,
  .crit1,
  .crit2,
  .crit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.critBkgColor};
    stroke-width: 2;
  }

  .activeCrit0,
  .activeCrit1,
  .activeCrit2,
  .activeCrit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.activeTaskBkgColor};
    stroke-width: 2;
  }

  .doneCrit0,
  .doneCrit1,
  .doneCrit2,
  .doneCrit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.doneTaskBkgColor};
    stroke-width: 2;
    cursor: pointer;
    shape-rendering: crispEdges;
  }

  .milestone {
    transform: rotate(45deg) scale(0.8,0.8);
  }

  .milestoneText {
    font-style: italic;
  }
  .doneCritText0,
  .doneCritText1,
  .doneCritText2,
  .doneCritText3 {
    fill: ${t.taskTextDarkColor} !important;
  }

  /* Done-crit task text outside the bar — same reasoning as doneText above. */
  .doneCritText0.taskTextOutsideLeft,
  .doneCritText0.taskTextOutsideRight,
  .doneCritText1.taskTextOutsideLeft,
  .doneCritText1.taskTextOutsideRight,
  .doneCritText2.taskTextOutsideLeft,
  .doneCritText2.taskTextOutsideRight,
  .doneCritText3.taskTextOutsideLeft,
  .doneCritText3.taskTextOutsideRight {
    fill: ${t.taskTextOutsideColor} !important;
  }

  .vert {
    stroke: ${t.vertLineColor};
  }

  .vertText {
    font-size: 15px;
    text-anchor: middle;
    fill: ${t.vertLineColor} !important;
  }

  .activeCritText0,
  .activeCritText1,
  .activeCritText2,
  .activeCritText3 {
    fill: ${t.taskTextDarkColor} !important;
  }

  .titleText {
    text-anchor: middle;
    font-size: 18px;
    fill: ${t.titleColor||t.textColor};
    font-family: ${t.fontFamily};
  }
`,"getStyles"),As=Ls,Ws={parser:Ge,db:Ms,renderer:$s,styles:As};export{Ws as diagram};
