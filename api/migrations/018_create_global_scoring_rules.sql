create table if not exists global_scoring_rules (
  id boolean primary key default true,
  rules jsonb not null default '{
    "batting": [
      { "id": "run", "label": "Each Run", "value": 1 },
      { "id": "four", "label": "Each Four", "value": 1 },
      { "id": "six", "label": "Each Six", "value": 2 },
      { "id": "thirty", "label": "30 Runs Bonus", "value": 3 },
      { "id": "fifty", "label": "50 Runs Bonus", "value": 5 },
      { "id": "century", "label": "100 Runs Bonus", "value": 10 },
      { "id": "duck", "label": "Duck Out", "value": -5 }
    ],
    "bowling": [
      { "id": "wicket", "label": "Each Wicket", "value": 20 },
      { "id": "maiden", "label": "Maiden Over", "value": 8 },
      { "id": "threew", "label": "3-Wicket Bonus", "value": 5 },
      { "id": "fourw", "label": "4-Wicket Bonus", "value": 10 },
      { "id": "fivew", "label": "5-Wicket Bonus", "value": 15 },
      { "id": "wide", "label": "Wide / No-ball", "value": -1 }
    ],
    "fielding": [
      { "id": "catch", "label": "Each Catch", "value": 10 },
      { "id": "stumping", "label": "Stumping", "value": 12 },
      { "id": "runout-direct", "label": "Runout (Direct Hit)", "value": 12 },
      { "id": "runout-indirect", "label": "Runout (Assist)", "value": 6 }
    ]
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint global_scoring_rules_singleton check (id = true)
);

insert into global_scoring_rules (id)
values (true)
on conflict (id) do nothing;
