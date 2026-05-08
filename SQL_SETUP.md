
-- SQL Setup for InsightHub (Supabase)

-- 1. Enable pgvector extension
create extension if not exists vector;

-- 2. Create items table
create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  type text not null, -- pdf, youtube, web, note
  title text not null,
  content text,
  summary text,
  keywords text[],
  url text,
  metadata jsonb,
  embedding vector(768), -- Using 768 for gemini-embedding-2-preview or text-embedding-004
  created_at timestamptz default now()
);

-- 3. Create index for vector search
create index on items using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- 4. Create function for similarity search (RAG)
create or replace function match_items (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  title text,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    items.id,
    items.title,
    items.content,
    1 - (items.embedding <=> query_embedding) as similarity
  from items
  where 1 - (items.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;
