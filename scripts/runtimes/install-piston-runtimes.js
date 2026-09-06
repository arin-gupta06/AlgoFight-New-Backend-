const install = async (lang, version) => {
  console.log(`Installing ${lang} ${version}...`);
  try {
    const res = await fetch('http://localhost:2000/api/v2/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: lang, version: version })
    });
    const data = await res.json();
    console.log(`Result for ${lang}:`, data);
  } catch(e) {
    console.error(`Failed to install ${lang}:`, e);
  }
};

const run = async () => {
  await install('node', '18.15.0');
  await install('python', '3.10.0');
  await install('java', '15.0.2');
  await install('gcc', '10.2.0');
  await install('typescript', '5.0.3');
  console.log("Done");
};

run();
