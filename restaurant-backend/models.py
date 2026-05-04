from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    phone = Column(String(20), unique=True, nullable=False)

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String(100))
    phone = Column(String(20))
    address = Column(Text)
    payment_method = Column(String(50))
    order_type = Column(String(50))
    special_instructions = Column(Text, nullable=True)
    coupon_code = Column(String(50), nullable=True)
    subtotal = Column(Float)
    discount = Column(Float)
    cgst = Column(Float)
    sgst = Column(Float)
    delivery = Column(Float)
    grand_total = Column(Float)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    item_id = Column(String(100))
    name = Column(String(100))
    price = Column(Float)
    quantity = Column(Integer)

    order = relationship("Order", back_populates="items")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    phone = Column(String(20))
    booking_date = Column(String(20))
    booking_time = Column(String(20))
    guests = Column(Integer)