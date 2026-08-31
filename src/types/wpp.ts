export interface Campaign {
  id: string
  name: string
  template_id: string | null
  status: string
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  ab_test_enabled: boolean
  ab_split_percent: number | null
  media_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CampaignSend {
  id: string
  campaign_id: string
  lead_id: string
  variant_id: string | null
  meta_message_id: string | null
  status: string
  cost: number | null
  sent_at: string | null
  delivered_at: string | null
  read_at: string | null
  failed_reason: string | null
  created_at: string
}

export interface NumberHealthSnapshot {
  id: string
  phone_number_id: string
  quality_rating: string
  messaging_tier: string
  captured_at: string
}
