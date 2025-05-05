# Uplinq Stripe Payment Integration

This server handles Stripe payment processing for the Uplinq website.

## Setup Instructions

### 1. Create a Stripe Account

First, you need to create a Stripe account if you don't already have one:

1. Go to [stripe.com](https://stripe.com) and sign up for an account
2. Verify your email and complete the account setup

### 2. Get Your API Keys

1. In your Stripe Dashboard, go to Developers → API keys
2. Make note of your Publishable Key and Secret Key
   - For testing, use the "Test" mode keys
   - For production, use the "Live" mode keys

### 3. Create Products and Prices

1. In your Stripe Dashboard, go to Products
2. Create products for each of your pricing plans:
   - Uplinq LaunchPad
   - VitaFlow Growth Engine
   - Uplinq Orbit Retainer (Monthly)
   - Uplinq Orbit Retainer (Annual)
3. For each product, create a Price:
   - Set the price amount
   - Choose One-time or Recurring (monthly/yearly)
   - Make note of the "Price ID" which starts with "price_"

### 4. Configure Environment Variables

1. Create a `.env` file in the server directory
2. Add the following environment variables:

```
# Stripe API keys
STRIPE_SECRET_KEY=sk_test_your_test_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_test_key_here

# Server port
PORT=4000

# Webhook secret (You'll get this in step 5)
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Your website URL
CLIENT_URL=http://localhost:5173
```

### 5. Set Up Webhook (Optional but Recommended)

For handling successful payments and other events:

1. In your Stripe Dashboard, go to Developers → Webhooks
2. Click "Add endpoint"
3. Use your server URL + "/api/webhook" (e.g., https://your-server.com/api/webhook)
4. Select events to listen for:
   - checkout.session.completed
   - payment_intent.succeeded
   - payment_intent.payment_failed
5. Get the "Signing Secret" and add it to your .env file as STRIPE_WEBHOOK_SECRET

### 6. Update Price IDs in the Code

1. In `src/pages/Pricing.tsx`, replace the placeholder price IDs with your actual Stripe price IDs:

```jsx
<PricingCard
  // Other properties...
  priceId="price_your_actual_price_id"
/>
```

2. In `src/lib/stripe.ts`, replace the placeholder publishable key with your actual Stripe publishable key:

```javascript
const stripePublishableKey = 'pk_test_your_publishable_key_here';
```

## Running the Server

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

The server will run on port 4000 by default or the port specified in your .env file.

## Testing Payments

When in test mode, use Stripe's test credit card numbers:

- Card number: 4242 4242 4242 4242
- Expiration date: Any future date
- CVC: Any 3 digits
- ZIP: Any 5 digits

Additional test card numbers can be found in the [Stripe documentation](https://stripe.com/docs/testing). 