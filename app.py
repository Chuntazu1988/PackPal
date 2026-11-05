import re

import streamlit as st
import streamlit.components.v1 as components
from pathlib import Path

# האתר עבר לכתובת חדשה (GitHub Pages): מהיר יותר, אפשר להתקין כאפליקציה, ועובד גם בלי אינטרנט.
# הדף הזה נשאר רק כדי שקישורים ישנים (גם קישורי טיול משותף) ימשיכו לעבוד, ומפנה לכתובת החדשה.
NEW_URL = "https://chuntazu1988.github.io/PackPal/"

# אייקון הלשונית: תמונה אם הקובץ קיים, ואחרת אימוג'י
_icon = Path(__file__).parent / "static" / "icon-192.png"
st.set_page_config(
    page_title="PackPal",
    page_icon=str(_icon) if _icon.exists() else "🧳",
    layout="centered",
)

# קישור לטיול משותף נראה כך: ?trip=<מזהה>. מעבירים אותו לכתובת החדשה.
# מקבלים רק אותיות, ספרות, מקף וקו תחתון, כדי שאי אפשר יהיה להחדיר קוד דרך הכתובת.
trip_id = st.query_params.get("trip", "")
if not re.fullmatch(r"[A-Za-z0-9_-]{12,64}", trip_id or ""):
    trip_id = ""
target = NEW_URL + ("?trip=" + trip_id if trip_id else "")

# מנסים להפנות אוטומטית (חלק מהדפדפנים חוסמים; אז נשאר הכפתור למטה)
components.html(
    '<script>try{window.top.location.replace("' + target + '");}catch(e){}</script>',
    height=0,
)

st.markdown(
    '<div dir="rtl" style="text-align:center;margin-top:3rem">'
    '<h1>🧳 PackPal עברה לכתובת חדשה</h1>'
    '<p style="font-size:1.1rem">האתר החדש מהיר יותר, אפשר להתקין אותו כאפליקציה בטלפון, והוא עובד גם בלי אינטרנט.</p>'
    "</div>",
    unsafe_allow_html=True,
)
_, mid, _ = st.columns([1, 2, 1])
with mid:
    st.link_button("לפתיחת PackPal ✈️", target, type="primary", use_container_width=True)
st.markdown(
    '<div dir="rtl" style="text-align:center;margin-top:1rem;color:#666">'
    "אם שמרת את הכתובת הישנה, כדאי להחליף אותה בכתובת החדשה: " + NEW_URL +
    "</div>",
    unsafe_allow_html=True,
)
