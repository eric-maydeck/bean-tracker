// Free-text origin details, as Bean Conqueror's origin rows hold them. Optional: absent = not sent.
export const COFFEE_ORIGIN_FIELDS = ['producer', 'farm', 'variety', 'region', 'elevation', 'harvest_time', 'certification'] as const;
export type CoffeeOriginField = (typeof COFFEE_ORIGIN_FIELDS)[number];
export const COFFEE_ORIGIN_LABELS: Record<CoffeeOriginField, string> = {
  producer: 'Producer', farm: 'Farm', variety: 'Variety', region: 'Region',
  elevation: 'Elevation', harvest_time: 'Harvest', certification: 'Certification'
};
export type CoffeeOriginFields = { [K in CoffeeOriginField]?: string | null };

export interface CoffeeRow extends CoffeeOriginFields {
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
  product_url: string | null;
  // The page the image was found on (Suggest pick / Fill from URL), else null. See lib/imageCredit.ts.
  image_source_url?: string | null;
  slug: string;
  opened_date: string | null;
  drank: number;
  status: 'backlog' | 'open' | 'archive';
  moved_date: string | null;
  decaf: number;
  // 1 = blend, 0 = single origin (BQ beanMix). Set by hand; never inferred from the name.
  blend: number;
  subscription_id: number | null;
  // List queries only (coffees.ts): 1 when a Bean Conqueror bean is linked.
  in_bean_conqueror?: number;
  // List queries + getCoffeeBySlug: bag minus linked bean's brews (open only), else null.
  grams_left?: number | null;
  // List queries + getCoffeeBySlug: the roaster's default image (roaster_images), else null.
  roaster_image_url?: string | null;
  // List queries + getCoffeeBySlug: the displayed image's backdrop (image_fills), else null.
  image_fill?: string | null;
  // List queries + getCoffeeBySlug: the displayed image's local copy (/img/…), else null.
  image_copy?: string | null;
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
  renewal_day: number | null;
  updated_at: string | null;
  subscription_url: string | null;
  paused: number; // 0 | 1
}

export interface RoastLevelRow {
  roast_level: string;
  degrees_of_roast: number;
}

export interface AlertRow {
  id: number;
  source: string;
  message: string;
  severity: string;
  created_at: string;
  read_at: string | null;
  dismissed_at: string | null;
}
