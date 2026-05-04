from sqlalchemy.orm import Session
import models
import schemas

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_user_by_phone(db: Session, phone: str):
    return db.query(models.User).filter(models.User.phone == phone).first()

def create_user(db: Session, user: schemas.UserCreate):
    db_user = models.User(
        name=user.name,
        email=user.email,
        phone=user.phone
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def create_order(db: Session, order: schemas.OrderCreate):
    db_order = models.Order(
        customer_name=order.name,
        phone=order.phone,
        address=order.address,
        payment_method=order.payment,
        order_type=order.orderType,
        special_instructions=order.specialInstructions,
        coupon_code=order.couponCode,
        subtotal=order.subtotal,
        discount=order.discount,
        cgst=order.cgst,
        sgst=order.sgst,
        delivery=order.delivery,
        grand_total=order.grandTotal
    )

    db.add(db_order)
    db.commit()
    db.refresh(db_order)

    for item in order.items:
        db_item = models.OrderItem(
            order_id=db_order.id,
            item_id=item.id,
            name=item.name,
            price=item.price,
            quantity=item.quantity
        )
        db.add(db_item)

    db.commit()
    return db_order

def create_booking(db: Session, booking: schemas.BookingCreate):
    db_booking = models.Booking(
        name=booking.name,
        phone=booking.phone,
        booking_date=booking.booking_date,
        booking_time=booking.booking_time,
        guests=booking.guests
    )
    db.add(db_booking)
    db.commit()
    db.refresh(db_booking)
    return db_booking

def get_orders(db: Session):
    return db.query(models.Order).order_by(models.Order.id.desc()).all()

def get_order(db: Session, order_id: int):
    return db.query(models.Order).filter(models.Order.id == order_id).first()

def get_bookings(db: Session):
    return db.query(models.Booking).order_by(models.Booking.id.desc()).all()
