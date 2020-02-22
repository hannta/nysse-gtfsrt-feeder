--
-- NOTE!
-- Replace <regionName> with actual region name / data provider name
--

DROP TABLE IF EXISTS <regionName>_trip_update_stop_time_updates;
DROP TABLE IF EXISTS <regionName>_trip_updates;

--
-- trip_updates
--
CREATE TABLE <regionName>_trip_updates (
  id varchar(95) NOT NULL,
  trip_id varchar(75) DEFAULT NULL,
  route_id varchar(75) DEFAULT NULL,
  direction_id tinyint(4) DEFAULT NULL,
  trip_start_time varchar(10) DEFAULT NULL,
  trip_start_date varchar(10) DEFAULT NULL,
  schedule_relationship varchar(10) DEFAULT NULL,
  vehicle_id varchar(10) DEFAULT NULL,
  vehicle_label varchar(15) DEFAULT NULL,
  vehicle_license_plate varchar(10) DEFAULT NULL,
  recorded datetime DEFAULT NULL,
  added timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

ALTER TABLE <regionName>_trip_updates
  ADD PRIMARY KEY id (id),
  ADD KEY trip_id (trip_id);

--
-- trip_update_stop_time_updates
--
CREATE TABLE <regionName>_trip_update_stop_time_updates (
  trip_update_id varchar(95) NOT NULL,
  stop_sequence int(11) DEFAULT NULL,
  stop_id varchar(20) DEFAULT NULL,
  arrival_delay int DEFAULT NULL,
  arrival_time int DEFAULT NULL,
  arrival_uncertainty int DEFAULT NULL,
  departure_delay int DEFAULT NULL,
  departure_time int DEFAULT NULL,
  departure_uncertainty int DEFAULT NULL,
  schedule_relationship int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

ALTER TABLE <regionName>_trip_update_stop_time_updates
  ADD PRIMARY KEY (trip_update_id,stop_id),
  ADD KEY trip_update_id (trip_update_id);	

ALTER TABLE <regionName>_trip_update_stop_time_updates
  ADD CONSTRAINT <regionName>_trip_update_stop_time_updates_key FOREIGN KEY (trip_update_id) REFERENCES <regionName>_trip_updates (id) ON DELETE CASCADE;
