CREATE TABLE applications (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    display_name TEXT NOT NULL
        CHECK (length(trim(display_name, char(9) || char(10) || char(13) || ' ')) > 0),
    executable_path TEXT NOT NULL
        CHECK (length(trim(executable_path, char(9) || char(10) || char(13) || ' ')) > 0),
    icon_cache_key TEXT
        CHECK (
            icon_cache_key IS NULL OR
            length(trim(icon_cache_key, char(9) || char(10) || char(13) || ' ')) > 0
        ),
    position INTEGER NOT NULL
        CHECK (typeof(position) = 'integer' AND position >= 0)
);

CREATE INDEX applications_by_position ON applications(position);
