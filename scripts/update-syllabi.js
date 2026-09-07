import fs from "node:fs/promises";
import * as cheerio from "cheerio";

const BASE="https://puchd.ac.in/nep-syllabus.php";
const FACULTIES=[
["1","Arts"],["2","Business Management and Commerce"],
["14","Dairying, Animal Husbandry and Agriculture"],
["3","Design and Fine Arts"],["4","Education"],["5","Languages"],
["6","Multi-Faculty Departments"],["7","Pharmaceutical Sciences"],["8","Science"]
];
const CAT=[["COMPLUSORY","Compulsory"],["COMPULSORY","Compulsory"],["MAJOR / MINOR","Major / Minor"],["ABILITY ENHANCEMENT COMPLUSORY COURSES [ AEC ]","AEC"],["ABILITY ENHANCEMENT COMPULSORY COURSES [ AEC ]","AEC"],["MULTI-DISCIPLINARY COURSES [ MDC/IDC ]","MDC / IDC"],["MULTI-DISCIPLINARY COURSES [ MDC / IDC ]","MDC / IDC"],["SKILL ENHANCEMENT COURSES / INTERNSHIP / DISSERTATION [ SEC ]","SEC"],["VALUE-ADDED COURSES [ VAC ]","VAC"]];
const clean=s=>(s||"").replace(/\s+/g," ").replace(/\u00a0/g," ").trim();
function year(s){const m=clean(s).match(/\b(20\d{2})\s*-\s*(20\d{2})\b/);return m?`${m[1]}-${m[2].slice(-2)}`:""}
function cat(s){const u=clean(s).toUpperCase();return CAT.find(([k])=>u.includes(k))?.[1]||""}
function sem(s){const t=clean(s).toLowerCase();let m=t.match(/sem(?:ester)?s?\s*(\d+)\s*(?:to|-)\s*(\d+)/);if(m)return[+m[1],+m[2]];m=t.match(/(\d+)\s*(?:&|and)\s*(\d+)\s*sem/);return m?[Math.min(+m[1],+m[2]),Math.max(+m[1],+m[2])]:[null,null]}
function prog(s){const u=s.toUpperCase();if(/B\.?\s*SC/.test(u))return"BSc";if(/B\.?\s*COM/.test(u))return"BCom";if(/B\.?\s*BA/.test(u))return"BBA";if(/B\.?\s*CA/.test(u))return"BCA";if(/B\.?\s*ED/.test(u))return"BEd";if(/B\.?\s*PHARM/.test(u))return"BPharm";if(/B\.?\s*DES/.test(u))return"BDes";if(/M\.?\s*SC/.test(u))return"MSc";if(/M\.?\s*COM/.test(u))return"MCom";if(/M\.?\s*CA/.test(u))return"MCA";if(/MBA/.test(u))return"MBA";if(/M\.?\s*A\b/.test(u))return"MA";if(/B\.?\s*A\b/.test(u))return"BA";return"Other"}
function types(s){const r=[];if(/HONOURS WITH RESEARCH/i.test(s))r.push("Honours with Research");else if(/HONOURS/i.test(s))r.push("Honours");if(/AS PER NEP|UNDER .*NEP/i.test(s))r.push("NEP");return r}
async function fetchPage(url){const r=await fetch(url,{headers:{"User-Agent":"PU-Syllabus-Finder-GitHubAction/1.0"}});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.text()}
async function main(){const out=[];for(const [fid,faculty] of FACULTIES){const url=`${BASE}?qstrfacid=${fid}`;console.log("Fetching",faculty);try{const $=cheerio.load(await fetchPage(url));let currentYear="",currentCat="";$("body *").each((_,el)=>{if($(el).children().length)return;const t=clean($(el).text()),y=year(t),c=cat(t);if(y&&c){currentYear=y;currentCat=c}});$("a").each((_,el)=>{const title=clean($(el).text()),href=$(el).attr("href");if(!href||!title)return;const low=href.toLowerCase();if(!low.includes("syllabus")&&!low.endsWith(".pdf"))return;if(title.toLowerCase()==="syllabi")return;const url2=new URL(href,BASE).href;const [a,b]=sem(title);out.push({id:"pu-"+Buffer.from(`${faculty}|${title}|${url2}`).toString("base64url").slice(0,24),faculty,academicYear:currentYear||year(title),category:currentCat||"Other",title,programme:prog(title),programmeType:types(title),semesterFrom:a,semesterTo:b,pdfUrl:url2,sourceUrl:BASE,status:"active",lastVerified:new Date().toISOString()})})}catch(e){console.error("Failed",faculty,e.message)}}const unique=[...new Map(out.map(x=>[x.pdfUrl,x])).values()].sort((a,b)=>a.faculty.localeCompare(b.faculty)||a.title.localeCompare(b.title));await fs.mkdir("data",{recursive:true});await fs.writeFile("data/syllabi.json",JSON.stringify(unique,null,2)+"\n");console.log("Total:",unique.length)}
main().catch(e=>{console.error(e);process.exit(1)})
