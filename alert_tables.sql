--
-- NOTE!
-- Replace <regionName> with actual region name / data provider name
--

DROP TABLE IF EXISTS <regionName>_alerts;
DROP TABLE IF EXISTS <regionName>_alert_informed_entities;
DROP TABLE IF EXISTS <regionName>_alert_header_texts;
DROP TABLE IF EXISTS <regionName>_alert_description_texts;
DROP TABLE IF EXISTS <regionName>_alert_urls;

--
-- alerts
--
CREATE TABLE <regionName>_alerts (
  id varchar(95) NOT NULL,
  start_time int DEFAULT NULL,
  end_time int DEFAULT NULL,
  cause varchar(20) DEFAULT NULL,
  effect varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

ALTER TABLE <regionName>_alerts
  ADD PRIMARY KEY id (id);

--
-- alert_informed_entities
--
CREATE TABLE <regionName>_alert_informed_entities (
  alert_id varchar(95) NOT NULL,
  agency_id varchar(20) DEFAULT NULL,
  route_id varchar(75) DEFAULT NULL,
  route_type int DEFAULT NULL,
  stop_id varchar(20) DEFAULT NULL,
  trip_id varchar(75) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

ALTER TABLE <regionName>_alert_informed_entities
  ADD KEY alert_id (alert_id),
  ADD CONSTRAINT <regionName>_alert_informed_entities_unique UNIQUE (alert_id,agency_id,route_id,route_type,stop_id,trip_id),
  ADD CONSTRAINT <regionName>_alert_informed_entities_fk FOREIGN KEY (alert_id) REFERENCES <regionName>_alerts (id) ON DELETE CASCADE;
  
--
-- alert_header_texts
--
CREATE TABLE <regionName>_alert_header_texts (
  alert_id varchar(95) NOT NULL,
  translated_text TEXT NOT NULL,
  language_code varchar(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

ALTER TABLE <regionName>_alert_header_texts
  ADD KEY alert_id (alert_id),
  ADD CONSTRAINT <regionName>_alert_header_texts_unique UNIQUE (alert_id,language_code),
  ADD CONSTRAINT <regionName>_alert_header_texts_fk FOREIGN KEY (alert_id) REFERENCES <regionName>_alerts (id) ON DELETE CASCADE;

--
-- alert_description_texts
--
CREATE TABLE <regionName>_alert_description_texts (
  alert_id varchar(95) NOT NULL,
  translated_text TEXT NOT NULL,
  language_code varchar(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

ALTER TABLE <regionName>_alert_description_texts
  ADD KEY alert_id (alert_id),
  ADD CONSTRAINT <regionName>_alert_description_texts_unique UNIQUE (alert_id,language_code),
  ADD CONSTRAINT <regionName>_alert_description_texts_fk FOREIGN KEY (alert_id) REFERENCES <regionName>_alerts (id) ON DELETE CASCADE;

--
-- alert_urls
--
CREATE TABLE <regionName>_alert_urls (
  alert_id varchar(95) NOT NULL,
  translated_text TEXT NOT NULL,
  language_code varchar(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

ALTER TABLE <regionName>_alert_urls
  ADD KEY alert_id (alert_id),
  ADD CONSTRAINT <regionName>_alert_urls_unique UNIQUE (alert_id,language_code),
  ADD CONSTRAINT <regionName>_alert_urls_fk FOREIGN KEY (alert_id) REFERENCES <regionName>_alerts (id) ON DELETE CASCADE;