#!/usr/bin/env node

/**

 * Script to make a user an admin

 * Usage: node make-admin.js <username>

 */

 

const { db } = require('./server/database/init');

 

const username = process.argv[2];

 

if (!username) {

  console.error('Usage: node make-admin.js <username>');

  process.exit(1);

}

 

db.run(

  'UPDATE users SET role = ? WHERE username = ?',

  ['admin', username],

  function(err) {

    if (err) {

      console.error('Error updating user role:', err);

      process.exit(1);

    }

 

    if (this.changes === 0) {

      console.error(`User '${username}' not found`);

      process.exit(1);

    }

 

    console.log(`✓ User '${username}' is now an admin!`);

 

    // Verify the change

    db.get(

      'SELECT username, email, role FROM users WHERE username = ?',

      [username],

      (err, user) => {

        if (err) {

          console.error('Error verifying user:', err);

        } else {

          console.log('\nUser details:');

          console.log('  Username:', user.username);

          console.log('  Email:', user.email);

          console.log('  Role:', user.role);

        }

        db.close();

      }

    );

  }

);
