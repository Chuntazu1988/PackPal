import streamlit as st
import streamlit.components.v1 as components
from pathlib import Path

st.set_page_config(page_title="PackPal", layout="wide")

html = (Path(__file__).parent / "index.html").read_text(encoding="utf-8")
# הגובה כאן הוא התחלתי בלבד – index.html מתאים אותו לתוכן באופן אוטומטי
components.html(html, height=900, scrolling=True)