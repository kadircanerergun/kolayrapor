# Subscription Feature Usage Guide

## Overview
The subscription feature allows users to view and subscribe to different pricing plans with variants (monthly, quarterly, yearly).

## Components

### 1. SubscriptionProducts Component
A reusable component that displays all subscription products with their variants and features.

**Location:** `/src/components/subscription-products.tsx`

**Usage:**
```tsx
import { SubscriptionProducts } from '@/components/subscription-products';

function MyComponent() {
  return <SubscriptionProducts />;
}
```

### 2. SubscriptionModal Component
A modal wrapper for the subscription products that can be opened from anywhere in the app.

**Location:** `/src/components/subscription-modal.tsx`

**Usage with useModal hook:**
```tsx
import { useModal } from '@/hooks/useModal';
import { SubscriptionModal } from '@/components/subscription-modal';

function MyComponent() {
  const { modal, openModal, closeModal } = useModal();

  const handleOpenSubscription = () => {
    openModal(<SubscriptionModal onClose={closeModal} />, {
      size: '6xl',
      showCloseButton: true,
    });
  };

  return (
    <div>
      <button onClick={handleOpenSubscription}>
        View Subscription Plans
      </button>
      {modal}
    </div>
  );
}
```

### 3. Subscription Page
A full page dedicated to subscription plans.

**Location:** `/src/routes/subscription.tsx`
**URL:** `/subscription`

Access via navigation in the sidebar or directly navigate to `/subscription`.

## API Service

**Location:** `/src/services/subscription-api.ts`

### Methods:

#### getProducts()
Fetches all available subscription products.

```tsx
import { subscriptionApiService } from '@/services/subscription-api';

const products = await subscriptionApiService.getProducts();
```

#### subscribe(plan)
Creates a subscription request for the selected product and variant.

```tsx
const result = await subscriptionApiService.subscribe({
  productId: 'professional',
  variantId: 'pro-yearly',
});

if (result.success) {
  console.log('Subscription successful:', result.data);
} else {
  console.error('Subscription failed:', result.error);
}
```

## Data Structure

### SubscriptionProduct
```typescript
{
  id: string;
  name: string;
  description: string;
  features: string[];
  variants: SubscriptionVariant[];
  isRecommended?: boolean;
}
```

### SubscriptionVariant
```typescript
{
  id: string;
  name: string;
  duration: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  isPopular?: boolean;
}
```

## Current State

### Mock Data
The `getProducts()` method currently returns mock data with three plans:
- **Temel Plan** (Basic): For small pharmacies
- **Profesyonel Plan** (Professional): For medium-sized pharmacies (Recommended)
- **Kurumsal Plan** (Enterprise): For large pharmacy chains

Each plan has three variants:
- Monthly (Aylık)
- Quarterly (Üç Aylık) - with discount
- Yearly (Yıllık) - with larger discount (marked as popular)

### Payment Integration
The `subscribe()` method currently returns a mock success response. Replace the API call when payment backend is ready:

```tsx
// In subscription-api.ts
async subscribe(plan: SubscriptionPlan): Promise<SubscriptionResponse> {
  // TODO: Replace with actual API call
  const response = await apiClient.post(`${this.baseUrl}/subscription/subscribe`, plan);
  return response.data;
}
```

## Navigation

The subscription page is accessible from the main sidebar:
- Icon: Credit Card (CreditCard from lucide-react)
- Label: "Abonelik"
- Description: "Abonelik planları ve yönetimi"

## Styling

The components use:
- Tailwind CSS for styling
- shadcn/ui components (Card, Button, Badge)
- Responsive grid layout (1 column on mobile, 2 on tablet, 3 on desktop)
- Primary color highlighting for recommended plans
- Discount badges and pricing information

## Future Enhancements

1. **Payment Integration:**
   - Integrate with payment provider (Stripe, PayPal, local payment gateway)
   - Add payment form/redirect after subscription selection
   - Handle payment callbacks and confirmations

2. **User Subscription Management:**
   - Display current active subscription
   - Allow plan upgrades/downgrades
   - Show subscription history
   - Enable cancellation

3. **Backend API:**
   - Replace mock data with real API endpoints
   - Add authentication/authorization
   - Store subscription data in database
   - Handle recurring billing

4. **Additional Features:**
   - Trial periods
   - Promo codes/discounts
   - Usage limits and tracking
   - Subscription expiry notifications
