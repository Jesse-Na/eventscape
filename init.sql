CREATE TABLE IF NOT EXISTS test (
    id SERIAL PRIMARY KEY,
    name VARCHAR,
    sold INT
);

INSERT INTO test (name,sold) VALUES ('Pumpkin', 3000);
INSERT INTO test (name,sold) VALUES ('Christmas Tree', 1000);
INSERT INTO test (name,sold) VALUES ('Socks', 10000);