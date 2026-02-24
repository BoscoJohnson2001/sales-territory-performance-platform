import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { supabase } from '../config/supabase';
import { verifyToken } from '../middleware/auth';

const router = Router();

// POST /api/auth/login — login by email OR userCode
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      res.status(400).json({ message: 'identifier and password are required' });
      return;
    }

    // Find user by email or userCode
    const { data: users, error } = await supabase
      .from('User')
      .select('*, Role(*)')
      .or(`email.eq.${identifier.toLowerCase()},userCode.eq.${identifier.toUpperCase()}`);

    if (error || !users || users.length === 0) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const user = users[0];

    if (!user.passwordHash) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ message: 'Account is deactivated. Contact your admin.' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.Role.name,
        userCode: user.userCode,
      },
      ENV.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        userCode: user.userCode,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.Role.name,
        isFirstLogin: user.isFirstLogin,
      },
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/auth/set-password — onboarding: validate token, set password
router.post('/set-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      res.status(400).json({ message: 'token and password are required' });
      return;
    }

    const { data: users, error } = await supabase
      .from('User')
      .select('*')
      .eq('onboardingToken', token);

    if (error || !users || users.length === 0) {
      res.status(400).json({ message: 'Invalid or expired token' });
      return;
    }

    const user = users[0];

    if (user.onboardingTokenExpiry && new Date(user.onboardingTokenExpiry) < new Date()) {
      res.status(400).json({ message: 'Token has expired. Contact your admin.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await supabase
      .from('User')
      .update({
        passwordHash,
        isFirstLogin: false,
        onboardingToken: null,
        onboardingTokenExpiry: null,
      })
      .eq('id', user.id);

    res.json({ message: 'Password set successfully. You can now log in.' });
  } catch (err) {
    console.error('[AUTH] Set-password error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/auth/me — get current authenticated user info
router.get('/me', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { data: users } = await supabase
      .from('User')
      .select('*, Role(*), SalesRepTerritory(*, Territory(*))')
      .eq('id', req.user!.userId);

    if (!users || users.length === 0) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const user = users[0];
    res.json({
      id: user.id,
      userCode: user.userCode,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.Role.name,
      isFirstLogin: user.isFirstLogin,
      territories: (user.SalesRepTerritory || []).map((t: any) => t.Territory),
    });
  } catch {
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
