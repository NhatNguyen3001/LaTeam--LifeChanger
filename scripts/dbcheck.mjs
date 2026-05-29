import { config } from "dotenv";
import postgres from "postgres";
config({ path: ".env" });

const sql = postgres(process.env.DIRECT_URL, { prepare: false, connect_timeout: 10 });
try {
  const trend = await sql`
    select to_char(w.date, 'YYYY') || ' Q' || extract(quarter from w.date)::int as term,
           round(avg(a.answer_value)::numeric,2)::float as avg
    from answers a join submissions s on a.submission_id=s.id join workshops w on s.workshop_id=w.id
    where a.answer_value is not null and w.date is not null
    group by term order by min(w.date)`;
  console.log("trend terms:", trend.length, trend);
  const themes = await sql`
    select theme, count(*)::int from (select unnest(themes) as theme from answers where themes is not null) t
    group by theme order by 2 desc limit 5`;
  console.log("top themes:", themes);
  const equity = await sql`
    select case when sc.icsea_percentile<34 then 'Lower' when sc.icsea_percentile<67 then 'Mid' else 'Higher' end as band,
           round(avg(a.answer_value)::numeric,2)::float as avg
    from answers a join submissions s on a.submission_id=s.id join workshops w on s.workshop_id=w.id join schools sc on w.school_id=sc.id
    where a.answer_value is not null and sc.icsea_percentile is not null group by band order by min(sc.icsea_percentile)`;
  console.log("equity bands:", equity);
  const quotes = await sql`select count(*)::int as n from answers where heartwarming and answer_value is null`;
  console.log("heartwarming open quotes:", quotes[0].n);
} catch (e) {
  console.log("ERR:", e.message);
} finally {
  await sql.end();
}
