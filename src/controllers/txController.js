const pool = require('../models/db');

// Deposit
exports.deposit = async (req, res, next) => {
  const userId = req.user.id;
  const amount = parseFloat(req.body.amount);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, userId]);
    await conn.query('INSERT INTO transactions (user_id, type, amount, description) VALUES (?, "deposit", ?, ?)', [userId, amount, 'Deposit via app']);
    await conn.commit();
    const [rows] = await pool.query('SELECT balance FROM users WHERE id = ?', [userId]);
    res.json({ success: true, balance: rows[0].balance });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// Withdraw
exports.withdraw = async (req, res, next) => {
  const userId = req.user.id;
  const amount = parseFloat(req.body.amount);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [userRows] = await conn.query('SELECT id, balance FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (!userRows.length) throw new Error('User not found');
    const currentBalance = parseFloat(userRows[0].balance);
    if (currentBalance < amount) {
      await conn.rollback();
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    await conn.query('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, userId]);
    await conn.query('INSERT INTO transactions (user_id, type, amount, description) VALUES (?, "withdrawal", ?, ?)', [userId, amount, 'Withdrawal via app']);

    await conn.commit();
    const [rows] = await pool.query('SELECT balance FROM users WHERE id = ?', [userId]);
    res.json({ success: true, balance: rows[0].balance });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// Transfer
exports.transfer = async (req, res, next) => {
  const fromUserId = req.user.id;
  const { toUserId } = req.body;
  const amount = parseFloat(req.body.amount);

  if (fromUserId === Number(toUserId)) return res.status(400).json({ error: 'Cannot transfer to yourself' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // consistent locking order
    const firstId = Math.min(fromUserId, toUserId);
    const secondId = Math.max(fromUserId, toUserId);

    const [rows1] = await conn.query('SELECT id, balance FROM users WHERE id = ? FOR UPDATE', [firstId]);
    const [rows2] = await conn.query('SELECT id, balance FROM users WHERE id = ? FOR UPDATE', [secondId]);

    const senderRow = (fromUserId === firstId ? rows1[0] : rows2[0]);
    const recipientRow = (fromUserId === firstId ? rows2[0] : rows1[0]);

    if (!senderRow || !recipientRow) throw new Error('One of the users not found');

    if (parseFloat(senderRow.balance) < amount) {
      await conn.rollback();
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    await conn.query('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, fromUserId]);
    await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, toUserId]);

    await conn.query('INSERT INTO transactions (user_id, type, amount, counterparty, description) VALUES (?, "transfer", ?, ?, ?)', [fromUserId, amount, toUserId, `Transfer to user ${toUserId}`]);
    await conn.query('INSERT INTO transactions (user_id, type, amount, counterparty, description) VALUES (?, "transfer", ?, ?, ?)', [toUserId, amount, fromUserId, `Transfer from user ${fromUserId}`]);

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// History
exports.history = async (req, res, next) => {
  const userId = req.user.id;
  try {
    const [rows] = await pool.query('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 200', [userId]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};
