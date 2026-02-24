import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { verifyToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// POST /api/auth/login — login by email OR userCode
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      res.status(400).json({ message: 'identifier and password are required' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase() },
          { userCode: identifier.toUpperCase() },
        ],
      },
      include: { role: true },
    });

    if (!user || !user.passwordHash) {
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
        role: user.role.name,
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
        role: user.role.name,
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

    const user = await prisma.user.findFirst({
      where: { onboardingToken: token },
    });

    if (!user) {
      res.status(400).json({ message: 'Invalid or expired token' });
      return;
    }

    if (user.onboardingTokenExpiry && user.onboardingTokenExpiry < new Date()) {
      res.status(400).json({ message: 'Token has expired. Contact your admin.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        isFirstLogin: false,
        onboardingToken: null,
        onboardingTokenExpiry: null,
      },
    });

    res.json({ message: 'Password set successfully. You can now log in.' });
  } catch (err) {
    console.error('[AUTH] Set-password error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/auth/me — get current authenticated user info
router.get('/me', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        role: true,
        territories: { include: { territory: true } },
      },
    });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json({
      id: user.id,
      userCode: user.userCode,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role.name,
      isFirstLogin: user.isFirstLogin,
      territories: user.territories.map((t) => t.territory),
    });
  } catch {
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
