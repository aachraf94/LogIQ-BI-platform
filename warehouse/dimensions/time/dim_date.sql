-- =============================================================================
-- DIMENSION: dim_date
-- Grain     : One row per calendar day — 2022-01-01 → 2026-12-31 (1 827 rows)
-- Source    : Static — arithmetic calendar spine, seeded once
-- Algerian calendar: weekend = Friday (DOW=5) + Saturday (DOW=6)
-- Ramadan/Eid dates are approximate Islamic calendar conversions.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouse.dim_date (
    date_id              DATE         PRIMARY KEY,
    year                 SMALLINT     NOT NULL,
    semester             SMALLINT     NOT NULL,   -- 1 or 2
    quarter              SMALLINT     NOT NULL,   -- 1–4
    month_num            SMALLINT     NOT NULL,   -- 1–12
    month_name_fr        VARCHAR(20)  NOT NULL,
    year_month           VARCHAR(7)   NOT NULL,   -- 'YYYY-MM'
    week_num             SMALLINT     NOT NULL,   -- ISO week number
    day_of_week          SMALLINT     NOT NULL,   -- 0=Dimanche … 6=Samedi
    day_name_fr          VARCHAR(20)  NOT NULL,
    is_weekend           BOOLEAN      NOT NULL,   -- Friday or Saturday
    is_friday            BOOLEAN      NOT NULL,   -- full day off in Algeria
    is_saturday          BOOLEAN      NOT NULL,   -- ~40% normal volume
    is_ramadan           BOOLEAN      NOT NULL,   -- 0.7× volume multiplier
    is_eid               BOOLEAN      NOT NULL,   -- 0.1× volume multiplier
    is_black_friday_week BOOLEAN      NOT NULL,   -- 2.0× volume multiplier
    volume_multiplier    DECIMAL(4,2) NOT NULL
);

INSERT INTO warehouse.dim_date (
    date_id, year, semester, quarter, month_num, month_name_fr, year_month,
    week_num, day_of_week, day_name_fr,
    is_weekend, is_friday, is_saturday,
    is_ramadan, is_eid, is_black_friday_week,
    volume_multiplier
)
SELECT
    d::DATE AS date_id,
    EXTRACT(YEAR  FROM d)::SMALLINT AS year,
    CASE WHEN EXTRACT(MONTH FROM d) <= 6 THEN 1 ELSE 2 END::SMALLINT AS semester,
    EXTRACT(QUARTER FROM d)::SMALLINT AS quarter,
    EXTRACT(MONTH   FROM d)::SMALLINT AS month_num,
    CASE EXTRACT(MONTH FROM d)::SMALLINT
        WHEN  1 THEN 'Janvier'    WHEN  2 THEN 'Février'
        WHEN  3 THEN 'Mars'       WHEN  4 THEN 'Avril'
        WHEN  5 THEN 'Mai'        WHEN  6 THEN 'Juin'
        WHEN  7 THEN 'Juillet'    WHEN  8 THEN 'Août'
        WHEN  9 THEN 'Septembre'  WHEN 10 THEN 'Octobre'
        WHEN 11 THEN 'Novembre'   WHEN 12 THEN 'Décembre'
    END AS month_name_fr,
    TO_CHAR(d, 'YYYY-MM') AS year_month,
    EXTRACT(WEEK FROM d)::SMALLINT AS week_num,
    EXTRACT(DOW  FROM d)::SMALLINT AS day_of_week,  -- 0=Dimanche … 6=Samedi
    CASE EXTRACT(DOW FROM d)::SMALLINT
        WHEN 0 THEN 'Dimanche'  WHEN 1 THEN 'Lundi'
        WHEN 2 THEN 'Mardi'     WHEN 3 THEN 'Mercredi'
        WHEN 4 THEN 'Jeudi'     WHEN 5 THEN 'Vendredi'
        WHEN 6 THEN 'Samedi'
    END AS day_name_fr,
    (EXTRACT(DOW FROM d) IN (5, 6)) AS is_weekend,
    (EXTRACT(DOW FROM d) = 5)       AS is_friday,
    (EXTRACT(DOW FROM d) = 6)       AS is_saturday,

    -- Ramadan dates (approximate Islamic calendar)
    (
        (d BETWEEN '2022-04-02' AND '2022-05-01') OR
        (d BETWEEN '2023-03-23' AND '2023-04-21') OR
        (d BETWEEN '2024-03-11' AND '2024-04-09') OR
        (d BETWEEN '2025-03-01' AND '2025-03-30') OR
        (d BETWEEN '2026-02-18' AND '2026-03-19')
    ) AS is_ramadan,

    -- Eid al-Fitr (end of Ramadan, 2 days) + Eid al-Adha (2 days)
    (
        d IN (
            '2022-05-02', '2022-05-03',  -- Eid al-Fitr 2022
            '2022-07-09', '2022-07-10',  -- Eid al-Adha 2022
            '2023-04-21', '2023-04-22',  -- Eid al-Fitr 2023
            '2023-06-27', '2023-06-28',  -- Eid al-Adha 2023
            '2024-04-10', '2024-04-11',  -- Eid al-Fitr 2024
            '2024-06-16', '2024-06-17',  -- Eid al-Adha 2024
            '2025-03-30', '2025-03-31',  -- Eid al-Fitr 2025
            '2025-06-06', '2025-06-07',  -- Eid al-Adha 2025
            '2026-03-20', '2026-03-21',  -- Eid al-Fitr 2026
            '2026-05-27', '2026-05-28'   -- Eid al-Adha 2026
        )
    ) AS is_eid,

    -- Black Friday week (week containing last Friday of November)
    (
        (d BETWEEN '2022-11-21' AND '2022-11-27') OR
        (d BETWEEN '2023-11-20' AND '2023-11-26') OR
        (d BETWEEN '2024-11-25' AND '2024-12-01') OR
        (d BETWEEN '2025-11-24' AND '2025-11-30') OR
        (d BETWEEN '2026-11-23' AND '2026-11-29')
    ) AS is_black_friday_week,

    -- Volume multiplier: Eid > Black Friday > Ramadan > Saturday > Friday > normal
    CASE
        WHEN d IN (
            '2022-05-02','2022-05-03','2022-07-09','2022-07-10',
            '2023-04-21','2023-04-22','2023-06-27','2023-06-28',
            '2024-04-10','2024-04-11','2024-06-16','2024-06-17',
            '2025-03-30','2025-03-31','2025-06-06','2025-06-07',
            '2026-03-20','2026-03-21','2026-05-27','2026-05-28'
        ) THEN 0.10
        WHEN (
            (d BETWEEN '2022-11-21' AND '2022-11-27') OR
            (d BETWEEN '2023-11-20' AND '2023-11-26') OR
            (d BETWEEN '2024-11-25' AND '2024-12-01') OR
            (d BETWEEN '2025-11-24' AND '2025-11-30') OR
            (d BETWEEN '2026-11-23' AND '2026-11-29')
        ) THEN 2.00
        WHEN (
            (d BETWEEN '2022-04-02' AND '2022-05-01') OR
            (d BETWEEN '2023-03-23' AND '2023-04-21') OR
            (d BETWEEN '2024-03-11' AND '2024-04-09') OR
            (d BETWEEN '2025-03-01' AND '2025-03-30') OR
            (d BETWEEN '2026-02-18' AND '2026-03-19')
        ) THEN 0.70
        WHEN EXTRACT(DOW FROM d) = 5 THEN 0.00  -- Friday
        WHEN EXTRACT(DOW FROM d) = 6 THEN 0.40  -- Saturday
        ELSE 1.00
    END AS volume_multiplier

FROM generate_series(
    '2022-01-01'::DATE,
    '2026-12-31'::DATE,
    '1 day'::INTERVAL
) AS d
ON CONFLICT (date_id) DO NOTHING;
