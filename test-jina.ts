async function run() {
  const url = "https://r.jina.ai/https://example.com";
  const res = await fetch(url, { headers: { 'Accept': 'text/plain' }});
  const text = await res.text();
  console.log(text);
}
run();
