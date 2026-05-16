-- =============================================================================
-- DIMENSION: dim_date
-- Grain   : One row per calendar day
-- Range   : 2022-01-01 to 2026-12-31 (covers full dataset range with margin)
-- SCD     : None — date dimension is static and never changes
-- Notes   : Algerian business calendar specifics included:
--           - Friday is a half-day (reduced volume)
--           - Weekend: Friday afternoon + Saturday + Sunday
--           - Ramadan and Eid dates for 2023, 2024, 2025 are hardcoded
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_date (
    date_key            SERIAL          PRIMARY KEY,

    full_date           DATE            NOT NULL UNIQUE,
    day_of_month        SMALLINT        NOT NULL,                   -- 1–31
    month_num           SMALLINT        NOT NULL,                   -- 1–12
    month_name_fr       VARCHAR(20)     NOT NULL,                   -- Janvier, Février, …
    quarter             SMALLINT        NOT NULL,                   -- 1–4
    year                SMALLINT        NOT NULL,
    day_of_week         SMALLINT        NOT NULL,                   -- 1 (Mon) to 7 (Sun) — ISO
    day_name_fr         VARCHAR(15)     NOT NULL,                   -- Lundi, Mardi, …
    week_of_year        SMALLINT        NOT NULL,                   -- ISO week number
    day_of_year         SMALLINT        NOT NULL,

    -- Algerian business calendar flags
    is_weekend          BOOLEAN         NOT NULL DEFAULT FALSE,     -- Saturday or Sunday
    is_friday           BOOLEAN         NOT NULL DEFAULT FALSE,     -- Friday = half working day
    is_ramadan          BOOLEAN         NOT NULL DEFAULT FALSE,     -- Ramadan period (volume ×0.7)
    is_eid_al_fitr      BOOLEAN         NOT NULL DEFAULT FALSE,     -- Eid Al-Fitr holiday (volume ×0.1)
    is_eid_al_adha      BOOLEAN         NOT NULL DEFAULT FALSE,     -- Eid Al-Adha holiday (volume ×0.1)
    is_algerian_holiday BOOLEAN         NOT NULL DEFAULT FALSE,     -- any national holiday

    -- Seasonal patterns
    is_november         BOOLEAN         NOT NULL DEFAULT FALSE,     -- e-commerce peak (+30%)
    is_december         BOOLEAN         NOT NULL DEFAULT FALSE,     -- end-of-year peak (+20%)
    is_january          BOOLEAN         NOT NULL DEFAULT FALSE,     -- post-holiday slowdown (×0.8)

    -- Convenience groupings
    year_month          CHAR(7)         NOT NULL,                   -- YYYY-MM for GROUP BY
    year_quarter        CHAR(7)         NOT NULL,                   -- YYYY-Q{n}

    -- Volume weight relative to a normal weekday (for reference — not used as a measure)
    business_day_weight NUMERIC(4,2)    NOT NULL DEFAULT 1.0,

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE warehouse.dim_date IS
    'Calendar dimension covering 2022-01-01 to 2026-12-31. Includes Algerian business calendar flags.';
COMMENT ON COLUMN warehouse.dim_date.day_of_week IS
    'ISO weekday: 1 = Monday, 7 = Sunday.';
COMMENT ON COLUMN warehouse.dim_date.is_ramadan IS
    'Approximate Ramadan periods: 2023 (Mar 23–Apr 21), 2024 (Mar 11–Apr 9), 2025 (Mar 1–Mar 29).';
COMMENT ON COLUMN warehouse.dim_date.business_day_weight IS
    'Relative parcel volume weight: Mon–Thu=1.0, Fri=0.6, Sat=0.4, Sun=0.15, Ramadan=0.7, Eid=0.1.';

-- Populate the date dimension for 2022-01-01 to 2026-12-31
INSERT INTO warehouse.dim_date (
    full_date, day_of_month, month_num, month_name_fr, quarter, year,
    day_of_week, day_name_fr, week_of_year, day_of_year,
    is_weekend, is_friday, is_ramadan, is_eid_al_fitr, is_eid_al_adha, is_algerian_holiday,
    is_november, is_december, is_january,
    year_month, year_quarter, business_day_weight
)
SELECT
    d::DATE                                         AS full_date,
    EXTRACT(DAY FROM d)::SMALLINT                   AS day_of_month,
    EXTRACT(MONTH FROM d)::SMALLINT                 AS month_num,
    CASE EXTRACT(MONTH FROM d)::INT
        WHEN 1  THEN 'Janvier'   WHEN 2  THEN 'Février'   WHEN 3  THEN 'Mars'
        WHEN 4  THEN 'Avril'     WHEN 5  THEN 'Mai'        WHEN 6  THEN 'Juin'
        WHEN 7  THEN 'Juillet'   WHEN 8  THEN 'Août'       WHEN 9  THEN 'Septembre'
        WHEN 10 THEN 'Octobre'   WHEN 11 THEN 'Novembre'   WHEN 12 THEN 'Décembre'
    END                                             AS month_name_fr,
    EXTRACT(QUARTER FROM d)::SMALLINT               AS quarter,
    EXTRACT(YEAR FROM d)::SMALLINT                  AS year,
    EXTRACT(ISODOW FROM d)::SMALLINT                AS day_of_week,
    CASE EXTRACT(ISODOW FROM d)::INT
        WHEN 1 THEN 'Lundi'    WHEN 2 THEN 'Mardi'    WHEN 3 THEN 'Mercredi'
        WHEN 4 THEN 'Jeudi'    WHEN 5 THEN 'Vendredi' WHEN 6 THEN 'Samedi'
        WHEN 7 THEN 'Dimanche'
    END                                             AS day_name_fr,
    EXTRACT(WEEK FROM d)::SMALLINT                  AS week_of_year,
    EXTRACT(DOY FROM d)::SMALLINT                   AS day_of_year,

    -- Weekend: Sat (6) or Sun (7)
    EXTRACT(ISODOW FROM d) IN (6, 7)               AS is_weekend,
    EXTRACT(ISODOW FROM d) = 5                      AS is_friday,

    -- Ramadan: 2023-03-23→04-21, 2024-03-11→04-09, 2025-03-01→03-29
    (d::DATE BETWEEN '2023-03-23' AND '2023-04-21'
     OR d::DATE BETWEEN '2024-03-11' AND '2024-04-09'
     OR d::DATE BETWEEN '2025-03-01' AND '2025-03-29') AS is_ramadan,

    -- Eid Al-Fitr (3 days after Ramadan ends each year)
    (d::DATE BETWEEN '2023-04-21' AND '2023-04-23'
     OR d::DATE BETWEEN '2024-04-09' AND '2024-04-11'
     OR d::DATE BETWEEN '2025-03-29' AND '2025-03-31') AS is_eid_al_fitr,

    -- Eid Al-Adha (approximate: 2023-06-28, 2024-06-17, 2025-06-07 + 2 days each)
    (d::DATE BETWEEN '2023-06-28' AND '2023-06-30'
     OR d::DATE BETWEEN '2024-06-16' AND '2024-06-18'
     OR d::DATE BETWEEN '2025-06-06' AND '2025-06-08') AS is_eid_al_adha,

    -- Algerian national holidays (fixed dates)
    (EXTRACT(MONTH FROM d), EXTRACT(DAY FROM d)) IN (
        (1,1), (5,1), (6,19), (7,5), (11,1)
    )                                               AS is_algerian_holiday,

    EXTRACT(MONTH FROM d) = 11                      AS is_november,
    EXTRACT(MONTH FROM d) = 12                      AS is_december,
    EXTRACT(MONTH FROM d) = 1                       AS is_january,

    TO_CHAR(d, 'YYYY-MM')                           AS year_month,
    TO_CHAR(d, 'YYYY') || '-Q' || EXTRACT(QUARTER FROM d)::TEXT AS year_quarter,

    -- Business day weight per Algerian logistics patterns
    CASE
        WHEN EXTRACT(ISODOW FROM d) = 7 THEN 0.15  -- Sunday
        WHEN EXTRACT(ISODOW FROM d) = 6 THEN 0.40  -- Saturday
        WHEN EXTRACT(ISODOW FROM d) = 5 THEN 0.60  -- Friday (half day)
        -- Eid
        WHEN (d::DATE BETWEEN '2023-04-21' AND '2023-04-23'
              OR d::DATE BETWEEN '2024-04-09' AND '2024-04-11'
              OR d::DATE BETWEEN '2025-03-29' AND '2025-03-31'
              OR d::DATE BETWEEN '2023-06-28' AND '2023-06-30'
              OR d::DATE BETWEEN '2024-06-16' AND '2024-06-18'
              OR d::DATE BETWEEN '2025-06-06' AND '2025-06-08') THEN 0.10
        -- Ramadan weekday
        WHEN (d::DATE BETWEEN '2023-03-23' AND '2023-04-21'
              OR d::DATE BETWEEN '2024-03-11' AND '2024-04-09'
              OR d::DATE BETWEEN '2025-03-01' AND '2025-03-29') THEN 0.70
        -- November peak
        WHEN EXTRACT(MONTH FROM d) = 11 THEN 1.30
        -- December peak
        WHEN EXTRACT(MONTH FROM d) = 12 THEN 1.20
        -- January slowdown
        WHEN EXTRACT(MONTH FROM d) = 1 THEN 0.80
        ELSE 1.00
    END                                             AS business_day_weight

FROM generate_series('2022-01-01'::DATE, '2026-12-31'::DATE, '1 day'::INTERVAL) AS d
ON CONFLICT (full_date) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_dim_date_year_month ON warehouse.dim_date (year, month_num);
CREATE INDEX IF NOT EXISTS idx_dim_date_year       ON warehouse.dim_date (year);
CREATE INDEX IF NOT EXISTS idx_dim_date_full_date  ON warehouse.dim_date (full_date);
