// Append-only. Never edit a shipped migration; add a new version instead.
export const MIGRATIONS: { version: number; statements: string[] }[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE leads (
        id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        ref                text NOT NULL UNIQUE,
        created_at         timestamptz NOT NULL DEFAULT now(),
        updated_at         timestamptz NOT NULL DEFAULT now(),

        status             text NOT NULL DEFAULT 'new',
        channel            text NOT NULL,
        service            text NOT NULL,

        name               text NOT NULL,
        phone              text NOT NULL,           -- E.164, +91XXXXXXXXXX
        pickup             text NOT NULL,
        drop_location      text,
        travel_date        date,
        travel_time        text,
        vehicle            text,
        passengers         int,
        message            text,

        -- attribution (first touch from the browser, or what the desk recorded)
        source             text,
        medium             text,
        campaign           text,
        term               text,
        content            text,
        gclid              text,
        fbclid             text,
        landing_page       text,
        referrer           text,

        -- desk workflow
        assigned_to        text,
        quoted_amount      int,
        booking_value      int,
        lost_reason        text,
        follow_up_at       timestamptz,
        first_contacted_at timestamptz,
        quoted_at          timestamptz,
        booked_at          timestamptz,
        closed_at          timestamptz,

        idempotency_key    text UNIQUE,
        user_agent         text,
        created_by         text
      )`,
      `CREATE INDEX leads_created_at_idx ON leads (created_at DESC)`,
      `CREATE INDEX leads_status_idx ON leads (status, created_at DESC)`,
      `CREATE INDEX leads_phone_idx ON leads (phone)`,
      `CREATE INDEX leads_travel_date_idx ON leads (travel_date)`,
      `CREATE TABLE lead_events (
        id         bigserial PRIMARY KEY,
        lead_id    uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        at         timestamptz NOT NULL DEFAULT now(),
        type       text NOT NULL,      -- created | status | note | assign | follow_up | notify_ok | notify_failed
        actor      text NOT NULL,      -- staff name, 'website' or 'system'
        data       jsonb NOT NULL DEFAULT '{}'::jsonb
      )`,
      `CREATE INDEX lead_events_lead_idx ON lead_events (lead_id, at)`,
    ],
  },
  {
    version: 2,
    statements: [
      // Demo leads for the pitch: badged in the desk, never exported as ad conversions, removable in one click.
      `ALTER TABLE leads ADD COLUMN is_sample boolean NOT NULL DEFAULT false`,
    ],
  },
];
