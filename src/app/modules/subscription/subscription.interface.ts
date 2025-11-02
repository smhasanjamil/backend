export interface ICreateSubscriptionRequest {
  planId: string;
  paymentMethodId: string;
}

export interface ICancelSubscriptionRequest {
  subscriptionId: string;
  cancelAtPeriodEnd?: boolean;
}

export interface IStripeWebhookEvent {
  type: string;
  data: {
    object: any;
  };
}
