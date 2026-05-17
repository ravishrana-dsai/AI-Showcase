# Setting Up the IDE, Python, and Libraries on a New Mac

Step-by-step guide for a non-technical person. Only covers: **Cursor (IDE)**, **Python**, and **Python libraries**. Nothing about project folders or the app itself.

---

## Part 1: Install Python

### Step 1.1: Download Python

1. Open your browser (Safari, Chrome, etc.).
2. Go to: **https://www.python.org/downloads**
3. Click the big yellow button that says **“Download Python 3.x.x”** (the latest version).
4. The installer file (e.g. **`python-3.12.x-macos11.pkg`**) will download to your **Downloads** folder.

### Step 1.2: Run the installer

1. Open **Finder** → **Downloads**.
2. Double-click the **Python** installer file (the one you just downloaded).
3. Click **Continue** through the screens.
4. When asked, read and accept the license, then click **Continue** and **Agree**.
5. Leave the default options as they are (just click **Continue**).
6. Click **Install**. Enter your Mac password if prompted.
7. Wait until you see **“The installation was successful.”**
8. Click **Close**.

### Step 1.3: Check that Python is installed

1. Open **Terminal**: press **Command + Space**, type **Terminal**, press **Enter**.
2. Type exactly and press **Enter**:
   ```bash
   python3 --version
   ```
3. You should see something like **`Python 3.12.0`** (the numbers may differ).

If you see **“command not found”**, Python did not install correctly. Run the installer again and make sure it finishes without errors.

### Step 1.4: Check that pip is installed (pip installs Python libraries)

1. In Terminal, type and press **Enter**:
   ```bash
   pip3 --version
   ```
2. You should see a line like **`pip 23.x.x from ...`**.

If **pip3** is not found, try:
```bash
python3 -m pip --version
```
If that works, you can use **`python3 -m pip`** instead of **`pip3`** in the steps below.

---

## Part 2: Install Cursor (the IDE)

### Step 2.1: Download Cursor

1. In your browser, go to: **https://cursor.com**
2. Click the button to **download Cursor for Mac**.
3. The file (e.g. **`Cursor-0.xx.x.dmg`**) will download to **Downloads**.

### Step 2.2: Install Cursor

1. Open **Finder** → **Downloads**.
2. Double-click the **Cursor** `.dmg` file.
3. A window will open with the Cursor icon. **Drag the Cursor icon into the Applications folder** (or follow the on-screen instructions).
4. When the copy is done, you can close the window. If you see a “disk” on your desktop, you can right-click it and choose **Eject**.
5. Open **Cursor** from **Applications** (or press **Command + Space**, type **Cursor**, press **Enter**).

### Step 2.3: First-time setup (optional)

1. The first time you open Cursor, you may be asked to **sign in** or **create an account**. You can do that if you want cloud features.
2. You can skip or complete the welcome / “Get Started” steps. No special settings are required for basic use.

---

## Part 3: Install Python libraries (using pip)

You install Python libraries from Terminal with **pip3** (or **python3 -m pip**). Run these from any folder; they install for your user account.

### Step 3.1: Open Terminal

- Press **Command + Space**, type **Terminal**, press **Enter**.

### Step 3.2: Upgrade pip (recommended)

Run this first so you have the latest pip:

```bash
pip3 install --upgrade pip
```

(If that fails, try: **`python3 -m pip install --upgrade pip`**.)

### Step 3.3: Install common libraries

Run each line below **one at a time**, wait for it to finish, then run the next.

**Data and science:**
```bash
pip3 install numpy
```
```bash
pip3 install pandas
```
```bash
pip3 install matplotlib
```
```bash
pip3 install scipy
```

**Jupyter (notebooks):**
```bash
pip3 install jupyter
```

**Requests (for HTTP / APIs):**
```bash
pip3 install requests
```

**Virtual environments (optional but good practice):**
```bash
pip3 install virtualenv
```

### Step 3.4: Check that libraries are installed

1. In Terminal, type:
   ```bash
   pip3 list
   ```
2. You should see a long list that includes **numpy**, **pandas**, **matplotlib**, **jupyter**, **requests**, etc.

To check one library by name, for example:
```bash
python3 -c "import numpy; print(numpy.__version__)"
```
You should see a version number (e.g. **1.26.0**).

---

## Part 4: Use Python from Cursor

1. Open **Cursor**.
2. Create or open any **`.py`** file (e.g. **File** → **New File**, then **File** → **Save As** and name it **`test.py`**).
3. Type something like:
   ```python
   print("Hello")
   import numpy as np
   print(np.__version__)
   ```
4. Open the **Terminal inside Cursor**: **Terminal** → **New Terminal** (or **View** → **Terminal**).
5. In that terminal, run your script:
   ```bash
   python3 test.py
   ```
   You should see **Hello** and the numpy version. That means Python and your libraries are working with Cursor.

---

## Quick reference

| What        | Where to get it        | Check command        |
|------------|------------------------|----------------------|
| Python     | https://www.python.org/downloads | `python3 --version`  |
| pip        | Comes with Python      | `pip3 --version`     |
| Cursor     | https://cursor.com    | Open Cursor from Applications |
| Libraries  | Via Terminal           | `pip3 install numpy pandas matplotlib jupyter requests` |

---

## Troubleshooting

- **“python3: command not found”**  
  Python is not installed or not on your PATH. Install Python from python.org again, then **close and reopen Terminal**.

- **“pip3: command not found”**  
  Use **`python3 -m pip`** instead of **`pip3`** in all the commands above (e.g. **`python3 -m pip install numpy`**).

- **“Permission denied” when installing libraries**  
  Do **not** use `sudo`. Install only for your user:
  ```bash
  pip3 install --user numpy
  ```
  (You can add **`--user`** to any **`pip3 install`** command if you get permission errors.)

- **Cursor doesn’t run or crashes**  
  Make sure you dragged Cursor into **Applications**. Try opening it again from Applications. If it still fails, download the installer again from cursor.com and reinstall.

That’s it: **IDE (Cursor)**, **Python**, and **Python libraries** only. No project folders or app setup.
