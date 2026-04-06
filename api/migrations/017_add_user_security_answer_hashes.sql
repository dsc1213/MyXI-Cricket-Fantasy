alter table users
  add column if not exists security_answer_1_hash text,
  add column if not exists security_answer_2_hash text,
  add column if not exists security_answer_3_hash text;

