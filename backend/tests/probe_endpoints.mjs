import { signJwt } from "../utils/security.js";

async function probe() {
  const token = signJwt({ id: "f1", role: "farmer" });
  console.log('Generated Farmer Token for f1');

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 1. selling-strategy
  try {
    const stratRes = await fetch('http://localhost:5000/api/ai/marketplace/selling-strategy', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ commodity: 'Tomato', quantity: 100 })
    });
    console.log('STRATEGY HTTP STATUS:', stratRes.status);
    const body = await stratRes.json();
    console.log('STRATEGY SUCCESS:', body.success);
    if (!body.success) console.log('STRATEGY ERROR BODY:', body);
  } catch(e) {
    console.error('STRATEGY FETCH ERROR:', e.message);
  }

  // 2. selling-plan
  try {
    const planRes = await fetch('http://localhost:5000/api/ai/marketplace/selling-plan', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({})
    });
    console.log('PLAN HTTP STATUS:', planRes.status);
    const body = await planRes.json();
    console.log('PLAN SUCCESS:', body.success);
    if (!body.success) console.log('PLAN ERROR BODY:', body);
  } catch(e) {
    console.error('PLAN FETCH ERROR:', e.message);
  }

  // 3. compare
  try {
    const compRes = await fetch('http://localhost:5000/api/ai/marketplace/compare', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ commodities: ['Tomato', 'Onion', 'Wheat'] })
    });
    console.log('COMPARE HTTP STATUS:', compRes.status);
    const body = await compRes.json();
    console.log('COMPARE SUCCESS:', body.success);
    if (!body.success) console.log('COMPARE ERROR BODY:', body);
  } catch(e) {
    console.error('COMPARE FETCH ERROR:', e.message);
  }

  // 4. Test with a Vendor token
  const vendorToken = signJwt({ id: "v1", role: "vendor" });
  try {
    const vRes = await fetch('http://localhost:5000/api/ai/marketplace/selling-strategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendorToken}` },
      body: JSON.stringify({ commodity: 'Tomato', quantity: 100 })
    });
    console.log('VENDOR ACCESS STATUS:', vRes.status);
    console.log('VENDOR ACCESS BODY:', await vRes.json());
  } catch(e) {
    console.error('VENDOR FETCH ERROR:', e.message);
  }

  // 5. Test without any token / empty cookie (unauthenticated browser session)
  try {
    const unauthRes = await fetch('http://localhost:5000/api/ai/marketplace/selling-strategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commodity: 'Tomato', quantity: 100 })
    });
    console.log('UNAUTH ACCESS STATUS:', unauthRes.status);
    console.log('UNAUTH ACCESS BODY:', await unauthRes.json());
  } catch(e) {
    console.error('UNAUTH FETCH ERROR:', e.message);
  }

  process.exit(0);
}

probe();
