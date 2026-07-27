CREATE TABLE categories (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    name TEXT NOT NULL COLLATE NOCASE UNIQUE
        CHECK (length(trim(name, char(9) || char(10) || char(13) || ' ')) > 0),
    position INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('inbox', 'user')),
    CHECK (
        (kind = 'inbox' AND id = '00000000-0000-0000-0000-000000000001') OR
        (kind = 'user' AND id <> '00000000-0000-0000-0000-000000000001')
    )
);

CREATE TABLE tasks (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    title TEXT NOT NULL
        CHECK (length(trim(title, char(9) || char(10) || char(13) || ' ')) > 0),
    status TEXT NOT NULL CHECK (status IN ('open', 'completed')),
    due_date TEXT CHECK (due_date IS NULL OR due_date GLOB '????-??-??'),
    category_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (updated_at >= created_at),
    FOREIGN KEY (category_id) REFERENCES categories(id) ON UPDATE RESTRICT ON DELETE RESTRICT
);

CREATE INDEX tasks_by_category_position ON tasks(category_id, position);
CREATE INDEX tasks_by_status_due_date ON tasks(status, due_date);

INSERT INTO categories (id, name, position, kind)
VALUES ('00000000-0000-0000-0000-000000000001', 'Inbox', 0, 'inbox');
