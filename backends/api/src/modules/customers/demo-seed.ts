import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { config } from "../../config.js";
import { inTransaction, pool } from "../../db.js";

export async function seedDemoData(): Promise<void> {
  if (!config.DEMO_MODE) return;
  async function seedStaff(email:string,password:string,role:"KYC_OFFICER"|"OPERATIONS_USER",firstName:string,lastName:string){
    const rows=await pool.query<any[]>("SELECT id FROM users WHERE email=? LIMIT 1",[email.toLowerCase()]);if(rows.length)return;
    const id=randomUUID(),passwordHash=await bcrypt.hash(password,12);
    await pool.query("INSERT INTO users(id,email,password_hash,role,status,kyc_status) VALUES(?,?,?,?, 'ACTIVE','APPROVED')",[id,email.toLowerCase(),passwordHash,role]);
    await pool.query("INSERT INTO customer_profiles(user_id,first_name,last_name,mobile_number,kyc_level) VALUES(?,?,?,?,?)",[id,firstName,lastName,"+257 00 00 00 00","LEVEL_2"]);
  }
  const existing = await pool.query<any[]>("SELECT id FROM users WHERE email=? LIMIT 1", [config.ADMIN_EMAIL.toLowerCase()]);
  if (!existing.length) {
    const id = randomUUID();
    const passwordHash = await bcrypt.hash(config.ADMIN_PASSWORD, 12);
    await pool.query("INSERT INTO users(id,email,password_hash,role,status,kyc_status) VALUES(?,?,?,'ADMIN','ACTIVE','APPROVED')", [id, config.ADMIN_EMAIL.toLowerCase(), passwordHash]);
    await pool.query("INSERT INTO customer_profiles(user_id,first_name,last_name,mobile_number,kyc_level) VALUES(?,?,?,?,?)", [id, "Great Lakes", "Administrator", "+0000000000", "LEVEL_2"]);
  }
  await seedStaff(config.KYC_OFFICER_EMAIL,config.KYC_OFFICER_PASSWORD,"KYC_OFFICER","Ariane","Ndayizeye");
  await seedStaff(config.OPERATIONS_USER_EMAIL,config.OPERATIONS_USER_PASSWORD,"OPERATIONS_USER","Claude","Niyongabo");
  const demoEmail = "johann.demo@greatlakesbank.test";
  const demoRows = await pool.query<any[]>("SELECT id FROM users WHERE email=? LIMIT 1", [demoEmail]);
  if (!demoRows.length) {
    const id = randomUUID(),passwordHash = await bcrypt.hash("GreatLakesDemo!2026", 12);
    await inTransaction(async (connection) => {
      await connection.query("INSERT INTO users(id,email,password_hash,role,status,kyc_status) VALUES(?,?,?,'CUSTOMER','ACTIVE','APPROVED')", [id,demoEmail,passwordHash]);
      await connection.query(`INSERT INTO customer_profiles(user_id,first_name,last_name,mobile_number,date_of_birth,nationality,identity_number,address_line1,city,postal_code,occupation,source_of_funds,kyc_level,risk_level) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [id,"Johann","Nkurunziza","+257 79 55 01 47","1985-05-14","Burundian","GLB-DEV-19850514","Avenue de la Paix","Bujumbura","1000","Business owner","Business income","LEVEL_2","LOW"]);
      const existingEveryday = await connection.query<any[]>("SELECT id,user_id FROM accounts WHERE account_number='7711034821' LIMIT 1");
      let everydayId:number|undefined;
      if (!existingEveryday.length) {
        const everyday:any = await connection.query("INSERT INTO accounts(user_id,account_name,account_type,account_number,balance_minor) VALUES(?,'Great Lakes everyday','everyday','7711034821',3248050)", [id]);
        everydayId = Number(everyday.insertId);
      } else if (existingEveryday[0].user_id === id) {
        everydayId = Number(existingEveryday[0].id);
      }
      const existingSavings = await connection.query<any[]>("SELECT id FROM accounts WHERE account_number='7711037204' LIMIT 1");
      if (!existingSavings.length) await connection.query("INSERT INTO accounts(user_id,account_name,account_type,account_number,balance_minor) VALUES(?,'Great Lakes savings','savings','7711037204',1450000)", [id]);
      if (everydayId) {
        const transactionRows = await connection.query<any[]>("SELECT id FROM transactions WHERE account_id=? LIMIT 1", [everydayId]);
        if (!transactionRows.length) {
          const transactions = [["debit","Shopping","Woolworths Food",84620,3163430],["credit","Income","Salary deposit",2850000,3248050],["debit","Transport","Uber",18450,3948050],["debit","Dining","The Test Kitchen",124000,3966500],["debit","Utilities","Eskom",218575,4090500]];
          for (const item of transactions) await connection.query("INSERT INTO transactions(account_id,type,category,description,amount_minor,currency,balance_after_minor) VALUES(?,?,?,?,?,'USD',?)", [everydayId,...item]);
        }
      }
    });
  }
  const presentationEmail=config.PRESENTATION_CUSTOMER_EMAIL.toLowerCase(),presentationRows=await pool.query<any[]>("SELECT id FROM users WHERE email=? LIMIT 1",[presentationEmail]);
  if(!presentationRows.length){const id=randomUUID(),passwordHash=await bcrypt.hash(config.PRESENTATION_CUSTOMER_PASSWORD,12);await inTransaction(async connection=>{await connection.query("INSERT INTO users(id,email,password_hash,role,status,kyc_status) VALUES(?,?,?,'CUSTOMER','ACTIVE','APPROVED')",[id,presentationEmail,passwordHash]);await connection.query("INSERT INTO customer_profiles(user_id,flexcube_customer_id,customer_number,first_name,middle_name,last_name,mobile_number,date_of_birth,nationality,identity_number,address_line1,city,occupation,source_of_funds,kyc_level,risk_level,mobile_verified,email_verified) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",[id,"FC-CIF-100284","GLB000100284","Aline","Nadine","Niyonkuru","+257 79 45 12 80","1991-04-18","Burundian","MOCK-BI-19910418-284","Rohero I, Avenue de la Paix","Bujumbura","Finance Manager","Salary","LEVEL_2","LOW",true,true]);});}
}
