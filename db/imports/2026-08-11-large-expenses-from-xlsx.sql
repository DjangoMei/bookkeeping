BEGIN IMMEDIATE;

UPDATE ledger_entries
SET owner = 'zcy', updated_at = CURRENT_TIMESTAMP
WHERE kind = 'large_expense'
  AND source = 'feishu'
  AND source_key GLOB 'feishu-large-[0-9][0-9]'
  AND owner = 'family';

CREATE TEMP TABLE large_expense_import (
  source_key TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  amount_cents INTEGER NOT NULL
);

INSERT INTO large_expense_import VALUES
  ('feishu-large-django-01', 'django', '2025-06-01', '电脑',  '数码',  2215200),
  ('feishu-large-django-02', 'django', '2025-06-01', '显示器',  '数码',  249900),
  ('feishu-large-django-03', 'django', '2025-07-01', '大电脑回收',  '数码',  -224500),
  ('feishu-large-django-04', 'django', '2025-07-01', '小电脑回收',  '数码',  -101000),
  ('feishu-large-django-05', 'django', '2025-07-01', '电脑桌＋斗柜',  '家居',  170000),
  ('feishu-large-django-06', 'django', '2025-07-01', '耳机',  '数码',  86400),
  ('feishu-large-django-07', 'django', '2025-09-01', '眼镜',  '个人',  340000),
  ('feishu-large-django-08', 'django', '2025-09-01', 'liberlive吉他',  '娱乐',  122700),
  ('feishu-large-django-09', 'django', '2025-09-01', '红米平板',  '数码',  294000),
  ('feishu-large-django-10', 'django', '2025-09-01', '妈生日礼物',  '礼物',  123900),
  ('feishu-large-django-11', 'django', '2025-09-01', '卖了一堆设备',  '数码',  -333900),
  ('feishu-large-django-12', 'django', '2025-09-01', 'Switch 2',  '娱乐',  319800),
  ('feishu-large-django-13', 'django', '2025-10-01', '键盘',  '数码',  48000),
  ('feishu-large-django-14', 'django', '2025-12-01', '路由器',  '数码',  130000),
  ('feishu-large-django-15', 'django', '2025-12-01', '卖AR眼镜',  '数码',  -112500),
  ('feishu-large-django-16', 'django', '2025-12-01', '卖VR眼镜',  '数码',  -78800),
  ('feishu-large-django-17', 'django', '2025-12-01', 'ITX主机',  '数码',  475500),
  ('feishu-large-django-18', 'django', '2026-01-01', '电脑电源',  '数码',  140800),
  ('feishu-large-django-19', 'django', '2026-03-01', '苹果手机',  '数码',  546900),
  ('feishu-large-django-20', 'django', '2026-03-01', '小折叠回收',  '数码',  -194000),
  ('feishu-large-django-21', 'django', '2026-03-01', '显示器',  '数码',  73400),
  ('feishu-large-django-22', 'django', '2026-04-01', '清闲工学椅',  '家居',  409900),
  ('feishu-large-django-23', 'django', '2026-05-01', '32寸显示器',  '数码',  119900);

UPDATE ledger_entries AS entry
SET owner = (
      SELECT imported.owner
      FROM large_expense_import AS imported
      WHERE imported.entry_date = entry.entry_date
        AND imported.amount_cents = entry.amount_cents
        AND replace(imported.title, '＋', '+') = replace(entry.title, '＋', '+')
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE entry.kind = 'large_expense'
  AND entry.owner = 'family'
  AND EXISTS (
    SELECT 1
    FROM large_expense_import AS imported
    WHERE imported.entry_date = entry.entry_date
      AND imported.amount_cents = entry.amount_cents
      AND replace(imported.title, '＋', '+') = replace(entry.title, '＋', '+')
  );

INSERT INTO ledger_entries (
  source_key, kind, owner, entry_date, month, title, category,
  amount_cents, detail, gift_type, source, created_by_role
)
SELECT
  imported.source_key,
  'large_expense',
  imported.owner,
  imported.entry_date,
  NULL,
  imported.title,
  imported.category,
  imported.amount_cents,
  '飞书原记录仅填写月份',
  NULL,
  'feishu',
  'system'
FROM large_expense_import AS imported
WHERE NOT EXISTS (
  SELECT 1
  FROM ledger_entries AS entry
  WHERE entry.kind = 'large_expense'
    AND entry.entry_date = imported.entry_date
    AND entry.amount_cents = imported.amount_cents
    AND replace(entry.title, '＋', '+') = replace(imported.title, '＋', '+')
);

DROP TABLE large_expense_import;

COMMIT;
