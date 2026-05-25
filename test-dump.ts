import fs from 'fs';
async function run() {
  const url = "https://chatgpt.com/share/6742510b-68e4-8003-8ee2-7bcec89b2513";
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }});
  const text = await res.text();
  fs.writeFileSync('dump.html', text);
  console.log("Wrote to dump.html");
}
run();
