# **Migration Guide: Postgres Alpine to Official Supabase Image**

**Objective:** Enable Realtime functionality by migrating from postgres:15-alpine to the official supabase/postgres image (Debian-based) which includes the required wal2json plugin.

⚠️ CRITICAL WARNING:  
The alpine (musl libc) and debian (glibc) operating systems use incompatible binary database formats. You cannot simply switch images.

* Attempting to reuse the existing volume will cause the database to crash.  
* **Procedure:** You MUST Dump (Backup) the data $\\rightarrow$ Wipe the old volume $\\rightarrow$ Switch Image $\\rightarrow$ Restore.

## **Step 1: Backup Full Data (Dump)**

While the old postgres:15-alpine container is **still running**, export all data, including Users, Roles, and Schemas.

**Run in your terminal:**

\# Replace 'db' with your actual database service name/container name  
docker exec \-t db pg\_dumpall \-c \-U postgres \> full\_backup.sql

* \-c: Includes commands to clean (drop) databases before creating them (useful for a clean restore).  
* \> full\_backup.sql: Saves the output to a file on your host machine.

## **Step 2: Clean Up Old Environment**

Shut down the containers and **remove the incompatible data volume**.

1. **Stop containers:**  
   docker-compose down

2. **Remove the old database volume:**  
   * If using Docker Volumes (Recommended):  
     Find your volume name (usually projectname\_db-data) and remove it.  
     \# List volumes to find the correct name  
     docker volume ls 

     \# Remove the volume (DATA WILL BE LOST HERE \- Ensure Step 1 was successful)  
     docker volume rm \<your\_project\_db\_volume\_name\>

   * If using Bind Mounts (local folder):  
     Simply delete or rename the local data folder (e.g., ./pgdata).

## **Step 3: Update docker-compose.yml**

Modify your database service configuration to use the official image and enable logical replication.

services:  
  db:  
    container\_name: db  
    \# \---------------------------------------------------------  
    \# 1\. CHANGE IMAGE: Use the official Supabase image  
    \# \---------------------------------------------------------  
    image: supabase/postgres:15.8.1.085  # Latest official version (PostgreSQL 15.8)   
      
    ports:  
      \- "5432:5432"  
    environment:  
      POSTGRES\_PASSWORD: ${POSTGRES\_PASSWORD}  
      POSTGRES\_DB: postgres  
    volumes:  
      \- db-data:/var/lib/postgresql/data  
    restart: always  
      
    \# \---------------------------------------------------------  
    \# 2\. UPDATE COMMAND: Enable wal\_level=logical for Realtime  
    \# \---------------------------------------------------------  
    command:   
      \- postgres  
      \- \-c  
      \- config\_file=/etc/postgresql/postgresql.conf  
      \- \-c  
      \- wal\_level=logical

## **Step 4: Start the New Environment**

Start the containers. Docker will pull the new image and initialize a fresh, empty database.

docker-compose up \-d

*Wait approximately 15-30 seconds for the database to finish initializing.*

## **Step 5: Restore Data**

Import your data from full\_backup.sql into the new database.

**For Linux / macOS / Git Bash:**

cat full\_backup.sql | docker exec \-i db psql \-U postgres

**For Windows (PowerShell):**

Get-Content full\_backup.sql | docker exec \-i db psql \-U postgres

### **ℹ️ Note on Restore Errors**

During the restore process, you might see errors like:

ERROR: role "postgres" already exists  
ERROR: role "anon" already exists

**This is normal.** The Supabase image comes pre-configured with default roles. The restore script will skip creating them and proceed to populate your data and permissions correctly.

## **Step 6: Verify Realtime**

1. **Restart the Realtime service** to ensure it picks up the new database configuration:  
   docker-compose restart realtime

2. **Check Logs:**  
   docker logs \-f realtime

**Success:** You should no longer see could not access file "wal2json". Instead, look for connection success messages.