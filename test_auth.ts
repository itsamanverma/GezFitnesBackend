async function test() {
  const baseUrl = 'http://localhost:3000';

  console.log("--- Testing Custom Mobile Social API (/api/auth/v1/social) ---");
  const socialRes = await fetch(`${baseUrl}/api/auth/v1/social`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      provider: "google",
      idToken: "fake_id_token_for_validation",
      deviceId: "dev-val-1",
      platform: "android"
    })
  });
  
  const socialText = await socialRes.text();
  console.log("Social Status:", socialRes.status);
  try {
    console.log("Social Response:", JSON.parse(socialText));
  } catch(e) {
    console.log("Social Response (Raw Text):", socialText);
  }
}

test().catch(console.error);
