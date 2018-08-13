// const mongodb = require('mongodb');
import mongodb from 'mongodb';

class DBUtil {
    constructor() {
        this.url = 'mongodb://172.96.211.88:27017';
        this.dbName = 'aaa';
    }

    async createConnection() {
        return await mongodb.MongoClient.connect(this.url);
    }

    async getDB() {
        const conn = await this.createConnection();
        return conn.db(this.dbName);
    }
}

class CrawlerDB {

    constructor() {
        this.dbUtil = new DBUtil();
    }

    async test() {
        const db = await this.dbUtil.getDB();
        // const res = await db.createCollection("movie3");

        let res = await db.collection('inserts').insertOne({a:2});

        console.log(res);
    }
}

let db = new CrawlerDB();
db.test();

