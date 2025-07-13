import type { SessionStorage } from "@shopify/shopify-app-session-storage";
import { Session } from "@shopify/shopify-api";
import { initMerchant } from "./merchant";

export class AppSessionStorage implements SessionStorage {
  prisma: any;
  constructor(prisma: any) {
    this.prisma = prisma;
    if (this.prisma.session === undefined) {
      throw new Error(`PrismaClient does not have a table`);
    }
  }
  async storeSession(session: Session) {
    const data = this.sessionToRow(session);
    await this.prisma.session.upsert({
      where: {
        id: session.id,
      },
      update: data,
      create: data,
    });
    const { shop } = session;

    console.log("storeSession", session);

    await initMerchant(shop);

    return true;
  }
  async loadSession(id: string) {
    const row = await this.prisma.session.findUnique({
      where: {
        id,
      },
    });
    if (!row) {
      return undefined;
    }
    return this.rowToSession(row);
  }
  async deleteSession(id: string) {
    try {
      await this.prisma.session.delete({
        where: {
          id,
        },
      });
    } catch {
      return true;
    }
    return true;
  }
  async deleteSessions(ids: string[]) {
    await this.prisma.session.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });
    return true;
  }
  async findSessionsByShop(shop: string) {
    const sessions = await this.prisma.session.findMany({
      where: {
        shop,
      },
      take: 25,
      orderBy: [
        {
          expires: "desc",
        },
      ],
    });
    return sessions.map((session: Session) => this.rowToSession(session));
  }
  sessionToRow(session: Session) {
    var _sessionParams$online;
    const sessionParams = session.toObject();
    return {
      id: session.id,
      shop: session.shop,
      state: session.state,
      isOnline: session.isOnline,
      scope: session.scope || null,
      expires: session.expires || null,
      accessToken: session.accessToken || "",
      userId:
        ((_sessionParams$online = sessionParams.onlineAccessInfo) === null ||
        _sessionParams$online === void 0
          ? void 0
          : _sessionParams$online.associated_user.id) || null,
    };
  }
  rowToSession(row: Row) {
    const sessionParams = {
      id: row.id,
      shop: row.shop,
      state: row.state,
      isOnline: row.isOnline,
      expires: 0,
      scope: "",
      accessToken: "",
      onlineAccessInfo: "",
    };
    if (row.expires) {
      sessionParams.expires = row.expires.getTime();
    }
    if (row.scope) {
      sessionParams.scope = row.scope;
    }
    if (row.accessToken) {
      sessionParams.accessToken = row.accessToken;
    }
    if (row.userId) {
      sessionParams.onlineAccessInfo = String(row.userId);
    }
    return Session.fromPropertyArray(Object.entries(sessionParams));
  }
}

interface Row extends Session {
  userId?: string;
  accessToken?: string;
  scope?: string;
}
