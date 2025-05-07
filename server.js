const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(express.json());

console.log(process.env.MONGO_URI);
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('MongoDB connection error:', err));

const UserSchema = new mongoose.Schema({
    login: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    player_id: { type: String, unique: true, required: true },
    score: { type: Number, default: 0 },
    achievements: { type: [String], default: [] }
});
const User = mongoose.model('User', UserSchema);

const AchievementSchema = new mongoose.Schema({
    id: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    points: { type: Number, required: true }
});
const Achievement = mongoose.model('Achievement', AchievementSchema);

app.post('/register', async (req, res) => {
    const { login, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const player_id = new mongoose.Types.ObjectId().toString();
    try {
        const user = await User.create({ login, password: hashedPassword, player_id });
        res.status(201).json({ message: 'User registered', player_id: user.player_id });
    } catch (err) {
        res.status(400).json({ error: 'User already exists' });
    }
});

app.get('/check-login', async (req, res) => {
    const login = req.query.login;
    const user = await User.findOne({ login });
    console.log('Here we go in /check-login');
    res.send(user ? "false" : "true");
});

app.post('/login', async (req, res) => {
    console.log('Here we go in login');
    const { login, password } = req.body;
    const user = await User.findOne({ login });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ player_id: user.player_id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, player_id: user.player_id });
});

app.get('/user-data', async (req, res) => {
    const { login, player_id } = req.query;
    try {
        let user;
        if (login) {
            user = await User.findOne({ login });
        } else if (player_id) {
            user = await User.findOne({ player_id });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            login: user.login,
            score: user.score,
            achievements: user.achievements
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/leaderboard', async (req, res) => {
    try {
        const topPlayers = await User.find({})
            .sort({ score: -1 })
            .limit(10)
            .select('login score -_id');

        res.json({ leaderboard: topPlayers });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/update-score', async (req, res) => {
    const { login, score } = req.body;

    if (!login || score === undefined) {
        return res.status(400).json({ error: 'Missing login or score' });
    }

    try {
        const result = await User.updateOne({ login }, { $inc: { score } });

        if (result.modifiedCount > 0) {
            res.json({ message: 'Score updated' });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/unlock-achievement', async (req, res) => {
    const { login, achievement_id } = req.body;

    if (!login || !achievement_id) {
        return res.status(400).json({ error: 'Missing login or achievement_id' });
    }

    try {
        const result = await User.updateOne(
            { login },
            { $addToSet: { achievements: achievement_id } }
        );

        if (result.modifiedCount > 0) {
            res.json({ message: 'Achievement unlocked' });
        } else {
            res.status(404).json({ error: 'User not found or achievement already unlocked' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
