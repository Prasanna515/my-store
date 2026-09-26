-- Run in Supabase > SQL Editor. Adds customer accounts support:
-- orders can optionally be linked to a logged-in customer, and a wishlist table.

alter table orders add column if not exists user_id uuid references auth.users(id);
create index if not exists orders_user_idx on orders (user_id);

create policy "customers read own orders" on orders
  for select to authenticated
  using (auth.uid() = user_id);

create table if not exists wishlist (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

alter table wishlist enable row level security;
create policy "customers manage own wishlist" on wishlist
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
