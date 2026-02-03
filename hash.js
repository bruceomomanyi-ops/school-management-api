const bcrypt = require('bcryptjs');

const passwords = {
  teacher: 'Teacher123!',
  student: 'Student123!',
  parent: 'Parent123!'
};

async function generateHashes() {
  for (const role in passwords) {
    const hash = await bcrypt.hash(passwords[role], 10);
    console.log(`${role} hash:`, hash);
  }
}

generateHashes().catch(console.error);