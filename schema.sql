-- ============================================================
-- CareTrack: Wound Care Compliance Tracker
-- Run this in your Supabase SQL Editor to set up the database
-- ============================================================

create table if not exists sessions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),

  -- Session metadata
  date                date not null,
  location            text,
  protocol_for_use    text,
  notes               text,

  -- Metric 1: MATT Applied
  matt_applied_num    integer,
  matt_applied_den    integer,

  -- Metric 2: Wedges Applied
  wedges_applied_num  integer,
  wedges_applied_den  integer,

  -- Metric 3: Turning & Repositioning
  turning_criteria_num integer,
  turning_criteria_den integer,

  -- Metric 4: MATT Applied Properly
  matt_proper_num     integer,
  matt_proper_den     integer,

  -- Metric 5: Wedges in Room
  wedges_in_room_num  integer,
  wedges_in_room_den  integer,

  -- Metric 6: Proper Wedge Offloading
  wedge_offload_num   integer,
  wedge_offload_den   integer,

  -- Metric 7: Air Supply in Room
  air_supply_num      integer,
  air_supply_den      integer
);

-- Enable Row Level Security
alter table sessions enable row level security;

-- Allow all operations for now (open access)
-- In production, replace with auth-based policies
create policy "Allow all access" on sessions
  for all using (true) with check (true);
