const mariadb = require('mariadb');

class GoodreadsRatings {                        

  constructor() {
    this.pool = mariadb.createPool({
      host: '192.168.2.104',
      user: 'goodreads',
      password: 'goodreads',
      database: 'Goodreads',
      connectionLimit: 5
    });
  }  

  async searchISBN(isbn) {
    let conn; 
    try {
      conn = await this.pool.getConnection();
      const query = 'SELECT star_rating, num_ratings FROM Scrape WHERE isbn = ?';

      const rows = await conn.query(query, [isbn]);

      if (rows.length === 0) {
        return null;
      }
      const row =rows[0]
      console.log(`Rating: ${row.star_rating}, Rating_Count: ${row.num_ratings}`);

      return {
        average_rating: row.star_rating,
        ratings_count: row.num_ratings
      };
    } catch (err) {
        console.error("Error occured with Goodreads Rating retrieval:", err);
        throw err;
    } finally {
        if (conn) {
          conn.release();
        }
    }
  }

  async searchTitle(title, author) {
    let conn; 
    try {
      conn = await pool.getConnection();
      const query = 'SELECT star_rating, num_ratings FROM Scrape WHERE name = ? AND author = ?';

      const rows = await conn.query(query, [title, author]);

      if (rows.length === 0) {
        return null;
      }

      const row = rows[0];
      
      console.log(`Rating: ${row.star_rating}, Rating_Count: ${row.num_ratings}`);

      return {
        average_rating: row.star_rating,
        ratings_count: row.num_ratings
      };
    } catch (err) {
        console.error("Error occured with Goodreads Rating retrieval:", err);
        throw err;
    } finally {
        if (conn) {
          conn.release();
        }
    }
  }


  async getMetadata(bookInfo) {
    const { isbn, title, author } = bookInfo;

    if (isbn) {
      const result = await this.searchISBN(isbn);
      if (result) return result;
    }

    if (title) {
      const result = await this.searchTitle(title, author);
      if (result) return result;
    }

    return null; 
  }
}

module.exports = new GoodreadsRatings();
      
      
                           
      
                        
