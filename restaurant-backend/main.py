from datetime import datetime, timedelta
import json
import os
import random
import urllib.parse
import urllib.request

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from openai import OpenAI, OpenAIError

import models
import schemas
import crud
from database import engine, SessionLocal, Base

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OTP_EXPIRY_MINUTES = 5
otp_store = {}
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY")) if os.getenv("OPENAI_API_KEY") else None
order_status_overrides = {}
ORDER_STATUS_FLOW = {
    "delivery": ["Preparing", "Packed", "Out for Delivery", "Delivered"],
    "pickup": ["Preparing", "Ready for Pickup", "Picked Up"],
    "takeaway": ["Preparing", "Ready for Pickup", "Picked Up"],
    "dine in": ["Table Assigned", "Preparing", "Served", "Completed"],
}

def build_local_menu_reply(message: str, order_mode: str, cart_items: list):
    text = message.lower()
    cart_names = ", ".join(item.name for item in cart_items) if cart_items else ""

    if "biryani" in text or "briyani" in text:
        return (
            "For biryani, try Chicken Biryani with Blue Lime Mojito. "
            "If you want a sharing option, Bucket Biryani works better for groups."
        )

    if "combo" in text or "offer" in text:
        return (
            "Best combo pick: Family Feast Meal for sharing, or Crispy Strips Combo "
            "for one person. Add a drink if this is a delivery order."
        )

    if "spicy" in text:
        return "Go for Hot Wings Box, Chicken 65, or Chettinad Chicken Curry. Pair it with Mango Milkshake to balance the spice."

    if "dessert" in text or "sweet" in text:
        return "For a sweet finish, choose a dessert after a spicy main. It works especially well with biryani or wings."

    if cart_names:
        return f"Nice cart: {cart_names}. For {order_mode}, I would add one drink and one light snack to complete it."

    return (
        "Tell me what you like: spicy, cheesy, light, or combo. "
        "I can suggest a short order from the menu."
    )

def normalize_phone(phone: str):
    phone = "".join(ch for ch in phone if ch.isdigit())
    if len(phone) == 10 and phone[0] in "6789":
      return phone
    raise HTTPException(status_code=400, detail="Enter a valid 10-digit Indian mobile number")

def generate_otp():
    return str(random.randint(100000, 999999))

def send_sms_otp(phone: str, otp: str):
    api_key = os.getenv("FAST2SMS_API_KEY")

    if not api_key:
        print(f"DEV OTP for {phone}: {otp}")
        return {"sent": False, "dev_otp": otp}

    payload = urllib.parse.urlencode({
        "authorization": api_key,
        "route": "otp",
        "variables_values": otp,
        "numbers": phone
    }).encode("utf-8")

    request = urllib.request.Request(
        "https://www.fast2sms.com/dev/bulkV2",
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )

    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            result = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"SMS provider failed: {exc}")

    if not result.get("return"):
        raise HTTPException(status_code=502, detail="SMS provider rejected the OTP request")

    return {"sent": True}

def save_otp(phone: str, purpose: str):
    otp = generate_otp()
    otp_store[(phone, purpose)] = {
        "otp": otp,
        "expires_at": datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)
    }
    return otp

def verify_otp(phone: str, purpose: str, otp: str):
    record = otp_store.get((phone, purpose))
    if not record:
        raise HTTPException(status_code=400, detail="Please request OTP first")

    if datetime.utcnow() > record["expires_at"]:
        otp_store.pop((phone, purpose), None)
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new OTP")

    if record["otp"] != otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    otp_store.pop((phone, purpose), None)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def home():
    return {"message": "Flavour Feast backend is running"}

@app.post("/otp/signup/send")
def send_signup_otp(user: schemas.SignupOtpRequest, db: Session = Depends(get_db)):
    phone = normalize_phone(user.phone)

    existing_email = crud.get_user_by_email(db, user.email)
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    existing_phone = crud.get_user_by_phone(db, phone)
    if existing_phone:
        raise HTTPException(status_code=400, detail="Phone already registered")

    otp = save_otp(phone, "signup")
    sms_status = send_sms_otp(phone, otp)
    response = {"message": "OTP sent to your phone"}
    if "dev_otp" in sms_status:
        response["dev_otp"] = sms_status["dev_otp"]
        response["message"] = "OTP sent successfully"
    return response

@app.post("/otp/signup/verify")
def verify_signup_otp(user: schemas.SignupOtpVerify, db: Session = Depends(get_db)):
    phone = normalize_phone(user.phone)
    verify_otp(phone, "signup", user.otp)

    create_user = schemas.UserCreate(name=user.name, email=user.email, phone=phone)
    saved_user = signup(create_user, db)
    return saved_user

@app.post("/otp/login/send")
def send_login_otp(user: schemas.LoginOtpRequest, db: Session = Depends(get_db)):
    phone = normalize_phone(user.phone)
    existing_user = crud.get_user_by_phone(db, phone)

    if not existing_user:
        raise HTTPException(status_code=404, detail="User not found. Please create an account first")

    otp = save_otp(phone, "login")
    sms_status = send_sms_otp(phone, otp)
    response = {"message": "OTP sent to your phone"}
    if "dev_otp" in sms_status:
        response["dev_otp"] = sms_status["dev_otp"]
        response["message"] = "OTP sent successfully"
    return response

@app.post("/otp/login/verify")
def verify_login_otp(user: schemas.LoginOtpVerify, db: Session = Depends(get_db)):
    phone = normalize_phone(user.phone)
    verify_otp(phone, "login", user.otp)
    return login(schemas.UserLogin(phone=phone), db)

@app.post("/signup")
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_email = crud.get_user_by_email(db, user.email)
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    existing_phone = crud.get_user_by_phone(db, user.phone)
    if existing_phone:
        raise HTTPException(status_code=400, detail="Phone already registered")

    saved_user = crud.create_user(db, user)
    return {
        "message": "Signup successful",
        "user_id": saved_user.id,
        "name": saved_user.name,
        "email": saved_user.email,
        "phone": saved_user.phone
    }

@app.post("/login")
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    existing_user = crud.get_user_by_phone(db, user.phone)

    if not existing_user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "message": "Login successful",
        "user": {
            "id": existing_user.id,
            "name": existing_user.name,
            "email": existing_user.email,
            "phone": existing_user.phone
        }
    }

@app.post("/orders")
def create_order(order: schemas.OrderCreate, db: Session = Depends(get_db)):
    saved_order = crud.create_order(db, order)
    return {
        "message": "Order placed successfully",
        "order_id": saved_order.id
    }

def status_flow_for(order_type: str):
    return ORDER_STATUS_FLOW.get((order_type or "delivery").lower(), ORDER_STATUS_FLOW["delivery"])

def order_status_for(order_id: int, order_type: str = "Delivery"):
    statuses = status_flow_for(order_type)
    if order_id in order_status_overrides:
        return order_status_overrides[order_id]
    return statuses[min((order_id - 1) % len(statuses), len(statuses) - 1)]

def serialize_order(order: models.Order):
    return {
        "id": order.id,
        "customer_name": order.customer_name,
        "phone": order.phone,
        "address": order.address,
        "payment_method": order.payment_method,
        "order_type": order.order_type,
        "special_instructions": order.special_instructions,
        "coupon_code": order.coupon_code,
        "subtotal": order.subtotal,
        "discount": order.discount,
        "cgst": order.cgst,
        "sgst": order.sgst,
        "delivery": order.delivery,
        "grand_total": order.grand_total,
        "status": order_status_for(order.id, order.order_type),
        "status_flow": status_flow_for(order.order_type),
        "items": [
            {
                "id": item.item_id,
                "name": item.name,
                "price": item.price,
                "quantity": item.quantity
            }
            for item in order.items
        ]
    }

@app.get("/orders")
def list_orders(db: Session = Depends(get_db)):
    return [serialize_order(order) for order in crud.get_orders(db)]

@app.get("/orders/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = crud.get_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return serialize_order(order)

@app.patch("/orders/{order_id}/status")
def update_order_status(order_id: int, request: schemas.OrderStatusUpdate, db: Session = Depends(get_db)):
    order = crud.get_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    allowed_statuses = status_flow_for(order.order_type)
    if request.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Invalid status for this order type")

    order_status_overrides[order_id] = request.status
    return serialize_order(order)

@app.post("/bookings")
def create_booking(booking: schemas.BookingCreate, db: Session = Depends(get_db)):
    saved_booking = crud.create_booking(db, booking)
    return {
        "message": "Booking created successfully",
        "booking_id": saved_booking.id
    }

@app.get("/bookings")
def list_bookings(db: Session = Depends(get_db)):
    return [
        {
            "id": booking.id,
            "name": booking.name,
            "phone": booking.phone,
            "booking_date": booking.booking_date,
            "booking_time": booking.booking_time,
            "guests": booking.guests
        }
        for booking in crud.get_bookings(db)
    ]

@app.post("/ai/menu-assistant")
def menu_assistant(request: schemas.MenuAssistantRequest):
    if not openai_client:
        return {
            "reply": build_local_menu_reply(request.message, request.order_mode, request.cart_items),
            "mode": "local"
        }

    cart_summary = "No items in cart"
    if request.cart_items:
        cart_summary = ", ".join(
            f"{item.quantity} x {item.name} (Rs.{item.price})"
            for item in request.cart_items
        )

    try:
        response = openai_client.responses.create(
            model=os.getenv("OPENAI_MODEL", "gpt-5.2"),
            input=[
                {
                    "role": "system",
                    "content": (
                        "You are Flavour Feast's friendly restaurant assistant. "
                        "Help customers choose food, combos, drinks, desserts, and ordering options. "
                        "Keep replies short, practical, and warm. Mention prices only when the user asks "
                        "or when the cart context includes them. Do not invent unavailable order IDs."
                    )
                },
                {
                    "role": "user",
                    "content": (
                        f"Order mode: {request.order_mode}\n"
                        f"Cart: {cart_summary}\n"
                        f"Customer message: {request.message}"
                    )
                }
            ],
        )
    except OpenAIError as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI request failed: {exc}")

    return {"reply": response.output_text, "mode": "openai"}
