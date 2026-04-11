const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  try {
    console.log("Navigating to http://localhost:3000/Login");
    // Ensure we go to the login page first
    await page.goto('http://localhost:3000/Login', { waitUntil: 'networkidle2' });
    
    // Switch to Register Tab and Create Account
    // The "tabButton2" element is the 2nd <p> in .loginSignUpTabs
    // Actually, we can just use the login page and try to login directly using the test credentials
    // since test@example.com is already registered from our test_auth.sh script.
    
    console.log("Filling login form...");
    await page.type('input[type="email"]', 'test@example.com');
    await page.type('input[type="password"]', 'password123');
    
    console.log("Submitting login form...");
    // Let's capture the API response for login
    let loginResponse;
    page.on('response', response => {
      if (response.url().includes('/api/auth/login')) {
         loginResponse = response;
      }
    });

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click('button[type="submit"]') // login button
      // Note: React-Hot-Toast might delay navigation by 1000ms 
    ]);

    console.log("Login successful, navigating to home...");
    
    // Now let's try to add a product to the cart from the home page.
    // E.g. .trendyProductImageCart
    console.log("Looking for Add to Cart button...");
    await page.waitForSelector('.trendyProductImageCart', { timeout: 10000 });
    
    // Capture the cart API response
    let cartPostResponse;
    page.on('response', response => {
      if (response.url().includes('/api/cart') && response.request().method() === 'POST') {
        cartPostResponse = response;
      }
    });

    console.log("Clicking first 'Add to Cart' button...");
    await page.click('.trendyProductImageCart');
    
    // wait a bit for the API call to finish
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (cartPostResponse) {
      console.log("Add to Cart Response Status:", cartPostResponse.status());
      try {
        const json = await cartPostResponse.json();
        console.log("Add to Cart Response JSON:", json);
      } catch (e) {
        console.log("Could not parse json from cart response");
      }
    } else {
      console.log("Did not intercept POST /api/cart request. It might have failed before sending.");
    }
    
  } catch (err) {
    console.error("Test Error:", err);
  } finally {
    await browser.close();
  }
})();
