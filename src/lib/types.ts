export interface CoffeeRow {
  id: number;
  roaster: string;
  coffee_name: string;
  origin: string | null;
  roast_level: string | null;
  processing: string | null;
  amount_g: number | null;
  cost: number | null;
  roast_date: string | null;
  frozen_start_date: string | null;
  frozen_end_date: string | null;
  rest_days_low: number | null;
  rest_days_high: number | null;
  image_url: string | null;
  drank: number;
  status: 'active' | 'finished';
  moved_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionRow {
  id: number;
  roaster_service: string;
  subscription_name: string | null;
  price: number | null;
  bag_count: number | null;
  amount_per_bag_g: number | null;
  purchased: number;
}

export interface RoastLevelRow {
  roast_level: string;
  degrees_of_roast: number;
}
