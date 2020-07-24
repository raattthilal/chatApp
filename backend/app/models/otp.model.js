module.exports = function Otp(sequelize) {
    var Sequelize = sequelize.constructor;
    var ret =
      sequelize.define('Otp', {
        phone: {
          type: Sequelize.STRING
        },    
        otp: {
            type: Sequelize.STRING
        },
        api_token: {
            type: Sequelize.STRING
        },
        is_used: {
            type: Sequelize.INTEGER
        },
        expiry: {
           type: Sequelize.STRING
        },
        created_at: {
          type: 'TIMESTAMP',
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          allowNull: false
        },
        modified_at: {
          type: 'TIMESTAMP',
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          allowNull: false
        }
  
      }, {
        tableName: 'otp',
        timestamps: false
  
      });
  
    return ret;
  }