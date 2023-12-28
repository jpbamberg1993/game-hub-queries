import pg from 'pg'
const { Pool } = pg

const env = process.argv[2]

let connectionString = env === 'prod'
	? process.env.PG_PROD_CONNECTION_STRING 
	: process.env.PG_DEV_CONNECTION_STRING
connectionString += "?sslmode=require"

const pool = new Pool({
	connectionString
})

const client = await pool.connect()

try {
	const { rows } = await getGameByName()
	console.table(rows)
} catch (error) {
	await client.query('ROLLBACK')
	console.error(`Transaction error: ${error.stack}`)
} finally {
	client.release()
}

async function getGames() {
	return await client.query(`
		select g.*
		from games g
		join games_to_genres gtg on g.id = gtg.game_id
		where gtg.genre_id = 4
	`);
}

async function deleteRecords() {
	const tables = await client.query(`select table_name from information_schema.tables where table_schema = 'public'`)

	for (let table of tables.rows) {
		await client.query(`truncate table ${table.table_name}`)
	}
}

async function getGamesWithChildren() {
	return await client.query(`
		SELECT g.id, g.name, g.background_image, json_agg(p) as platforms
		FROM (
			SELECT g.*
			FROM games g
			JOIN games_to_platforms gtp on gtp.game_id = g.id
			JOIN platforms p on gtp.platform_id = p.id
			WHERE p.slug = 'pc'
		) as g
		JOIN games_to_platforms gtp on gtp.game_id = g.id
		JOIN platforms p on gtp.platform_id = p.id
		JOIN games_to_genres gtg on gtg.game_id = g.id
		JOIN genres genres on genres.id = gtg.genre_id
		WHERE genres.slug = 'action'
		GROUP BY g.id, g.name, g.background_image
		LIMIT 20
	`)
}

async function getGameByName() {
	return await client.query(`
		SELECT * FROM games WHERE name ILIKE LOWER('Little Misfortune')
	`)
}

process.exit(0)
