import re

import streamlit as st
import streamlit.components.v1 as components
from pathlib import Path

# אייקון הלשונית: תמונה אם הקובץ קיים, ואחרת אימוג'י
_icon = Path(__file__).parent / "static" / "icon-192.png"
st.set_page_config(
    page_title="PackPal",
    page_icon=str(_icon) if _icon.exists() else "🧳",
    layout="wide",
)

html = (Path(__file__).parent / "index.html").read_text(encoding="utf-8")

# קישור לטיול משותף נראה כך: https://packpal.streamlit.app/?trip=<מזהה>
# מעבירים את המזהה לאפליקציה. מקבלים רק אותיות, ספרות, מקף וקו תחתון,
# כדי שאי אפשר יהיה להחדיר קוד דרך הכתובת.
trip_id = st.query_params.get("trip", "")
if not re.fullmatch(r"[A-Za-z0-9_-]{12,64}", trip_id or ""):
    trip_id = ""
html = html.replace("@@PACKPAL_TRIP_ID@@", trip_id)

# הגובה כאן הוא התחלתי בלבד – index.html מתאים אותו לתוכן באופן אוטומטי
components.html(html, height=900, scrolling=True)
