declare namespace Express {
    interface Request {
        user?: {
            uid: string;
            email: string | null;
            name: string | null;
            picture: string | null;
        };
    }
}
