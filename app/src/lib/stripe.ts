import Stripe from 'stripe';
import { stripeConfig } from './config';

export const stripe = new Stripe(stripeConfig.secretKey);
