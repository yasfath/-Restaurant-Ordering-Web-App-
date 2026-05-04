from pydantic import BaseModel, Field
from typing import List, Optional

class UserCreate(BaseModel):
    name: str
    email: str
    phone: str

class UserLogin(BaseModel):
    phone: str

class SignupOtpRequest(BaseModel):
    name: str
    email: str
    phone: str

class SignupOtpVerify(BaseModel):
    name: str
    email: str
    phone: str
    otp: str

class LoginOtpRequest(BaseModel):
    phone: str

class LoginOtpVerify(BaseModel):
    phone: str
    otp: str

class OrderItemCreate(BaseModel):
    id: str
    name: str
    price: float
    quantity: int

class OrderCreate(BaseModel):
    name: str
    phone: str
    address: str
    payment: str
    orderType: str
    specialInstructions: Optional[str] = ""
    couponCode: Optional[str] = ""
    subtotal: float
    discount: float
    cgst: float
    sgst: float
    delivery: float
    grandTotal: float
    items: List[OrderItemCreate]

class BookingCreate(BaseModel):
    name: str
    phone: str
    booking_date: str
    booking_time: str
    guests: int

class MenuAssistantRequest(BaseModel):
    message: str
    order_mode: Optional[str] = "Delivery"
    cart_items: List[OrderItemCreate] = Field(default_factory=list)

class OrderStatusUpdate(BaseModel):
    status: str
